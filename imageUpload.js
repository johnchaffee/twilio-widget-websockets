require("dotenv").config();

const AWS = require("aws-sdk");
const path = require("path");
const fs = require("fs");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// Bucket names must be unique across all S3 users

const myBucket = "ziplio-images";
const myKey = "jpeg";
const fileName = "demo.jpg";

fs.readFile(fileName, function (err, data) {
  if (err) {
    throw err;
  }

  params = { Bucket: myBucket, Key: fileName, Body: data };

  s3.putObject(params, function (err, data) {
    if (err) {
      console.log(err);
    } else {
      console.log("Successfully uploaded data to myBucket/myKey");
    }
  });
});
