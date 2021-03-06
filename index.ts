#!/usr/bin/env node

require("dotenv").config();
const fs = require("fs");
const https = require("https");
const terminalImage = require("terminal-image");
const terminalLink = require("terminal-link");
const got = require("got");
const chalk = require("chalk");
const inquirer = require("inquirer");

var argv = require("yargs/yargs")(process.argv.slice(2))
  .usage("Usage: npx ts-node $0 <command> [options]")
  .options({
    r: {
      alias: "retry",
      description: "Automatically retry search until a match is found",
      type: "boolean",
    },
    q: {
      alias: "query",
      description:
        "Specify a word to search for instead having a word picked from a list at random",
      type: "string",
      nargs: 1,
    },
  })
  .help("h")
  .alias("h", "help").argv;

if (!argv.query) {
  var wordList = fs.readFileSync("10000-common-english-words.txt", "utf8").toString().split("\n");
}
// console.log(wordList);
const isVolumeDetailOptional = false;
let hasRetryStarted = false;
const MAX_API_CALLS = 10;
let countApiCalls = 0;

const randomArrayElement = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

const main = () => {
  ++countApiCalls;
  if (countApiCalls >= MAX_API_CALLS) {
    console.log("Sorry, we couldn't find a match.");
    return 1;
  }
  const req = https.request(getRequestOptions(wordList), (res) => {
    // console.log(`statusCode: ${res.statusCode}`);

    let data = "";
    res.on("data", (chunk) => {
      data += chunk;
    });
    res.on("end", () => {
      const parsedData = JSON.parse(data);
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
        removeEmptyProps(volumes);
        const chosenVolume = randomArrayElement(volumes);
        printOutput(chosenVolume);
      }
    });
  });

  req.on("error", (error) => {
    console.error(error);
  });

  req.end();
};

function getRequestOptions(wList) {
  const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;
  const BASE_URL = "https://www.googleapis.com/books/v1/volumes";
  const chosenWord = argv.query || randomArrayElement(wList);

  const queryParams = {
    // filter: "full",
    printType: "books",
    // projection: "lite",
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
  // console.log("request path: " + path);

  return {
    hostname: "googleapis.com",
    port: 443,
    path: path,
    method: "GET",
  };
}

// remove properties with no value
const removeEmptyProps = (volumes: Array<Object>) => {
  volumes.forEach((volume) => {
    for (const [prop, value] of Object.entries(volume)) {
      if (value === undefined) {
        delete volume[prop];
      }
    }
  });
};

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

  (async () => {
    const body = await got(volume.image).buffer();
    console.log(await terminalImage.buffer(body, { width: "30%", height: "30%" }));
  })();
};

main();
