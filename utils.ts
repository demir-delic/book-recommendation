const chalk2 = require("chalk");

const randomArrayElement = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

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

const logAxiosError = (error, isDebugModeEnabled) => {
  if (isDebugModeEnabled) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      console.log(error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log("Error", error.message);
    }
    console.log(error.config);
  } else {
    console.log(
      chalk2.red(
        "An API request error has occurred. There may be a problem with your API keys or your internet connection.",
        "\nTo display a detailed error message, run this script with the -debug flag."
      )
    );
  }
  process.exit();
};

module.exports = { randomArrayElement, removeEmptyProps, logAxiosError };
