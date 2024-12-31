import express from "express";
import multer from "multer";
import slugify from "slugify";
import cors from "cors";
import pok from "./pok.json" assert { type: "json" };
import { LoremIpsum } from "lorem-ipsum";
import CryptoJS from "crypto-js";
import { bufferToFormData, decryptMessage, encryptMessage } from "./utils.js";
import axios from "axios";

const sharedKey = Buffer.from(
  "603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4",
  "hex"
);
const lorem = new LoremIpsum({
  sentencesPerParagraph: {
    max: 8,
    min: 4,
  },
  wordsPerSentence: {
    max: 16,
    min: 4,
  },
});

// const decrypt = ;

const app = express();
app.use(express.json({ limit: "1000mb" }));
app.use(express.urlencoded({ extended: true, limit: "1000mb" }));

const pokemons = pok.map((el) => {
  return {
    id: crypto.randomUUID(),
    image: el.image_url,
    name: el.pokemon,
    description: lorem.generateParagraphs(1),
  };
});

app.use(
  cors({
    origin: "*",
  })
);

app.use("/public", express.static("./storage"));

const storage = multer({
  storage: multer.diskStorage({
    destination: "storage",
    filename: (req, file, cb) => {
      const filename =
        slugify(file.originalname, {
          lower: true,
          remove: /[^a-zA-Z0-9\s-]/g,
        }) +
        "." +
        file.originalname.split(".").at(-1);

      cb(null, filename);
    },
  }),
});

app.post("/pokemons2", storage.single("image"), (req, res) => {
  const pokemon = {
    id: crypto.randomUUID(),
    name: req.body.name,
    description: req.body.desc || lorem.generateParagraphs(1),
    image: `http://localhost:9000/public/${req.file.filename}`,
  };

  if (!pokemons.find((p) => p.id === pokemon.id)) pokemons.push(pokemon);

  res.json({ msg: "success", pokemon });
});

app.post("/pokemons", async (req, res) => {
  const { encryptedData, iv } = req.body;

  if (!encryptedData || !iv) {
    return res.status(400).send("Données chiffrées ou IV manquants.");
  }

  console.log("req.body", req.body);

  try {
    const decryptedData = decryptMessage(req.body.encryptedData, iv);

    const decryptedBuffer = Buffer.from(
      Buffer.from(decryptedData, "hex").toString(),
      "hex"
    );

    const formData = bufferToFormData(decryptedBuffer, req.body.boundary);

    req.body = formData;

    const response = await axios.post(
      "http://localhost:9000/pokemons2",

      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    const criv = CryptoJS.enc.Hex.parse(sharedKey.toString("base64"));
    //   res.json(response.data);
    res.json({
      encryptedData: encryptMessage(
        Buffer.from(JSON.stringify(response.data)),
        criv
      ),
      iv: criv,
    });
  } catch (err) {
    console.error("Erreur lors du déchiffrement :", err);
    res.status(400).send("Erreur lors du déchiffrement.");
  }
});

app.get("/pokemons", (req, res) => {
  const criv = CryptoJS.enc.Hex.parse(sharedKey.toString("base64"));

  res.json({
    encryptedData: encryptMessage(Buffer.from(JSON.stringify(pokemons)), criv),
    iv: criv,
  });
});

app.listen(9000, () => {
  console.log("server started at port 9000");
});
