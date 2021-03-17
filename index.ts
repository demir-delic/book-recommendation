#!/usr/bin/env node

require("dotenv").config();
const utils = require("./utils");
const fs = require("fs");
const https = require("https");
const terminalImage = require("terminal-image");
const terminalLink = require("terminal-link");
const axios = require("axios").default;
const got = require("got");
const chalk = require("chalk");
const inquirer = require("inquirer");

var argv = require("yargs/yargs")(process.argv.slice(2))
  .usage("Usage: npx ts-node $0 <command> [options]")
  .options({
    l: {
      alias: "lowdetail",
      description: "Don't require a recommended book to include a description and download link",
      type: "boolean",
    },
    n: {
      alias: "noimage",
      description: "Don't display a recommended book's cover image",
      type: "boolean",
    },
    q: {
      alias: "query",
      description:
        "Specify a word to search for instead having a word picked from a list at random",
      type: "string",
      nargs: 1,
    },
    r: {
      alias: "retry",
      description: "Automatically retry search until a match is found",
      type: "boolean",
    },
  })
  .help("h")
  .alias("h", "help").argv;

async function getRandomWord() {
  // https://rapidapi.com/dpventures/api/wordsapi
  const RAPIDAPI_WORDS_API_KEY = process.env.RADIDAPI_WORDS_API_KEY;

  let options = {
    method: "GET",
    url: "https://wordsapiv1.p.rapidapi.com/words/",
    params: { random: "true" },
    headers: {
      "x-rapidapi-key": RAPIDAPI_WORDS_API_KEY,
      "x-rapidapi-host": "wordsapiv1.p.rapidapi.com",
    },
  };

  try {
    const response = await axios.request(options);
    return response.data.word;
  } catch (error) {
    utils.logAxiosError(error);
  }
}

const randomWordAfterPromiseIsResolved = (async () => {
  await getRandomWord();
})();

if (!argv.query) {
  var randomWord = utils.randomArrayElement(
    fs.readFileSync("10000-common-english-words.txt", "utf8").toString().split("\n")
  );
}
const isVolumeDetailOptional = argv.lowdetail ? true : false;
let hasRetryStarted = false;
const MAX_API_CALLS = 10;
let countApiCalls = 0;

const main = () => {
  ++countApiCalls;
  if (countApiCalls >= MAX_API_CALLS) {
    console.log("Sorry, we couldn't find a match.");
    return 1;
  }
  const req = https.request(getRequestOptions(randomWord), (res) => {
    // console.log(`statusCode: ${res.statusCode}`);

    let data = "";
    res.on("data", (chunk) => {
      data += chunk;
    });
    res.on("end", () => {
      const parsedData = JSON.parse(data);
      // console.log(JSON.stringify(parsedData, null, 2));

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
        if (argv.retry) {
          if (!hasRetryStarted) {
            process.stdout.write("Searching");
            hasRetryStarted = true;
          }
          process.stdout.write(".");
          req.end();
          main();
        } else {
          inquirer
            .prompt([
              {
                type: "input",
                message: "No matches were found. Search again? (y/n)",
                name: "search_again",
              },
            ])
            .then((answer) => {
              if (answer.search_again === "n" || answer === "no") {
                return 1;
              } else {
                console.log("Searching...");
                req.end();
                main();
              }
            })
            .catch((error) => {
              if (error.isTtyError) {
                // Prompt couldn't be rendered in the current environment
                console.error(error);
              } else {
                // Something else went wrong
                console.error("not ttyerror", error);
              }
            });
        }
      } else {
        utils.removeEmptyProps(volumes);
        const chosenVolume = utils.randomArrayElement(volumes);
        printOutput(chosenVolume);
      }
    });
  });

  req.on("error", (error) => {
    console.error(error);
  });

  req.end();
};

function getRequestOptions(word) {
  const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;
  const BASE_URL = "https://www.googleapis.com/books/v1/volumes";
  const chosenWord = argv.query || word;

  const queryParams = {
    // filter: "full",
    printType: "books",
    projection: "lite",
    langRestrict: "en",
    maxResults: 40,
    q: chosenWord, // full-text query string
  };

  let query = "";

  // assumes that there is at least one query parameter
  for (const [queryParam, value] of Object.entries(queryParams)) {
    query += `${queryParam}=${value}&`;
  }

  const path = `${BASE_URL}?${query}key=${GOOGLE_BOOKS_API_KEY}`;

  return {
    hostname: "googleapis.com",
    port: 443,
    path: path,
    method: "GET",
  };
}

const printOutput = (volume) => {
  console.log(
    `\n\n${chalk.bold.underline(volume.title + (volume.subtitle ? `: ${volume.subtitle}` : ""))}`,
    `${volume.description ? `\n\n${volume.description}` : ""}`,
    `${
      volume.epubLink || volume.pdfLink
        ? `\n\nDownload:
  ${volume.pdfLink ? `- ${terminalLink("PDF", volume.pdfLink)}` : ""}
  ${volume.epubLink ? `- ${terminalLink("ePUB", volume.epubLink)}` : ""}`
        : ""
    }
`
  );
  if (!argv.noimage) {
    (async () => {
      const body = await got(volume.image).buffer();
      console.log(await terminalImage.buffer(body, { width: "30%", height: "30%" }));
    })();
  }
};

main();
