const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { translateHandlebars } = require("./childProcess/readWritemainProcess");
const morgan = require("morgan");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));

// Setup upload folder
const upload = multer({ dest: "uploads/" });

// app.post("/upload", upload.single("file"), async (req, res) => {
//   try {
//     const uploadedFilePath = req.file.path;
//     const originalFileName = req.file.originalname;
//     const outFileName = originalFileName.replace(
//       /\.handlebars$/,
//       `.translated.handlebars`
//     );
//     const outFilePath = path.join("translated", outFileName);

//     const content = fs.readFileSync(uploadedFilePath, "utf-8");
//     await translateHandlebars(content, "ja", outFilePath);

//     res.download(outFilePath, outFileName, () => {
//       fs.unlinkSync(uploadedFilePath);
//       fs.unlinkSync(outFilePath);
//     });
//   } catch (err) {
//     console.error("❌ Translation error:", err);
//     res.status(500).json({ error: "Translation failed." });
//   }
// });

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const uploadedFilePath = req.file.path;
    const originalFileName = req.file.originalname;

    // Read file content
    let content = fs.readFileSync(uploadedFilePath, "utf-8");

    // Assuming translateHandlebars returns translated content string instead of writing file
    const translatedContent = await translateHandlebars(content, (req.body.language).trim() || "fr");

    // Delete the uploaded file after processing
    fs.unlinkSync(path.join(__dirname,uploadedFilePath));

    // Send translated content as response (you can adjust content-type if needed)
    res.type("text/plain").send(translatedContent);
  } catch (err) {
    console.error("❌ Translation error:", err);
    res.status(500).json({ error: "Translation failed." });
  }
});

app.get("/", (req, res) => res.send("welcome to translator"));

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
