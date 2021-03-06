require("dotenv").config();
const fs = require("fs");
const https = require("https");
const terminalImage = require("terminal-image");
const terminalLink = require("terminal-link");
const got = require("got");
const chalk = require("chalk");

function randomArrayElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

const wordList = fs.readFileSync("10000-common-english-words.txt", "utf8").toString().split("\n");
// console.log(wordList);
const randomWord = randomArrayElement(wordList);
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;
const BASE_URL = "https://www.googleapis.com/books/v1/volumes";
const isVolumeDetailOptional = true;

// https://openlibrary.org/isbn/9780140328721.json

// const options = {
//   hostname: 'openlibrary.org',
//   port: 443,
//   path: '/isbn/9780140328721.json',
//   method: 'GET',
// };

const queryParams = {
  // filter: "full",
  printType: "books",
  // projection: "lite",
  langRestrict: "en",
  maxResults: 40,
  q: randomWord, // full-text query string
};

let query = "";

// assumes that there is at least one query parameter
for (const [queryParam, value] of Object.entries(queryParams)) {
  query += `${queryParam}=${value}&`;
}

const path = `${BASE_URL}?${query}key=${GOOGLE_BOOKS_API_KEY}`;
// console.log("request path: " + path);

const options = {
  hostname: "googleapis.com",
  port: 443,
  path: path,
  method: "GET",
};

const req = https.request(options, (res) => {
  // console.log(`statusCode: ${res.statusCode}`);

  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });
  res.on("end", () => {
    let parsedData = JSON.parse(data);
    // console.log(parsedData);

    let volumes = [];

    // extract properties used by application
    parsedData.items.forEach((volume) => {
      if (
        isVolumeDetailOptional ||
        (volume.volumeInfo.description &&
          (volume.accessInfo.epub.downloadLink || volume.accessInfo.pdf.downloadLink))
      ) {
        volumes.push({
          title: volume.volumeInfo.title,
          subtitle: volume.volumeInfo?.subtitle,
          description: volume.volumeInfo?.description,
          image: volume.volumeInfo.imageLinks?.thumbnail,
          epubLink: volume.accessInfo.epub?.downloadLink,
          pdfLink: volume.accessInfo.pdf?.downloadLink,
        });
      }
    });

    if (!volumes?.length) {
      console.log("no matches");
      return 1;
    }

    // remove properties with no value
    volumes.forEach((volume) => {
      for (const [prop, value] of Object.entries(volume)) {
        if (value === undefined) {
          delete volume[prop];
        }
      }
    });

    const chosenVolume = randomArrayElement(volumes);

    printOutput(chosenVolume);
  });
});

req.on("error", (error) => {
  console.error(error);
});

req.end();

const printOutput = (volume) => {
  console.log(
    `${chalk.bold.underline(volume.title + (volume.subtitle ? `: ${volume.subtitle}` : ""))}`,
    `${volume.description ? `\n\n${volume.description}` : ""}`,
    `\n\n`,
    `${
      volume.epubLink || volume.pdfLink
        ? `Download:
  ${volume.pdfLink ? `- ${terminalLink("PDF", volume.pdfLink)}` : ""}
  ${volume.epubLink ? `- ${terminalLink("ePUB", volume.epubLink)}` : ""}`
        : ""
    }
`
  );

  (async () => {
    const body = await got(volume.image).buffer();
    console.log(await terminalImage.buffer(body, { width: "30%", height: "30%" }));
  })();
};
