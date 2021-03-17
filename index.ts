#!/usr/bin/env node

require("dotenv").config();
const utils = require("./utils");
const fs = require("fs");
const terminalImage = require("terminal-image");
const terminalLink = require("terminal-link");
const axios = require("axios").default;
const got = require("got");
const chalk = require("chalk");
const inquirer = require("inquirer");

var argv = require("yargs/yargs")(process.argv.slice(2))
  .usage("Usage: npx ts-node $0 <command> [options]")
  .options({
    d: {
      alias: "debug",
      description: "Display detailed errors and debugging information",
      type: "boolean",
    },
    l: {
      alias: "lowdetail",
      description: "Don't require a recommended book to include a description and download link",
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
    console.log("Sorry, a match could not be found.");
    return 1;
  }
  getRandomWord().then((word) => {
    // console.log(word);
    getBookResults(word).then((response) => {
      let volumes = [];

      // extract properties used by application
      response.data.items.forEach((volume) => {
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
                main();
              }
            })
            .catch((error) => {
              if (error.isTtyError) {
                // Prompt couldn't be rendered in the current environment
                console.error("Inquirer Prompt TTY Error", error);
              } else {
                // Something else went wrong
                console.error("Inquirer Prompt Error", error);
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
};

const getRandomWord = async () => {
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
    utils.logAxiosError(error, argv.debug);
  }
};

const getBookResults = async (word) => {
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

  let options = {
    method: "GET",
    url: path,
  };

  try {
    const response = await axios.request(options);
    return response;
  } catch (error) {
    utils.logAxiosError(error, argv.debug);
  }
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
