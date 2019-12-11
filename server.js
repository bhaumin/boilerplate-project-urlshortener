"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const MongoClient = require("mongodb").MongoClient;
const dns = require("dns");

require("dotenv").config();

const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

/** this project needs a db !! **/
const uri = process.env.MONGOLAB_URI;
const dbName = process.env.DB_NAME;
// console.log(db);

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Connect the MongoDB server
(async () => {
  try {
    await client.connect();
    // console.log("Connected to the DB server");
  } catch (err) {
    console.log(err.stack);
  }
})();

app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here
var urlencodedParser = bodyParser.urlencoded({ extended: false });

app.use("/public", express.static(process.cwd() + "/public"));

app.get("/", function(req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

// your first API endpoint...
app.get("/api/hello", function(req, res) {
  res.json({ greeting: "hello API" });
});

app.post("/api/shorturl/new", urlencodedParser, async function(req, res) {
  const inputUrl = req.body.url.trim();

  try {
    const result = await createNewShortUrl(inputUrl);
    res.json(result);
  } catch (err) {
    console.log(err);
  }
});

app.get("/api/shorturl/:code", async function(req, res) {
  const shortUrlCode = parseInt(req.params.code.trim());

  try {
    const origUrl = await getUrlByCode(shortUrlCode);
    res.redirect(origUrl);
  } catch (err) {
    console.log(err);
    res.json({ error: "Short URL does not exist" });
  }
});

app.listen(port, function() {
  console.log("Node.js listening ...");
});


// Implementation

function checkUrlValidity(url) {
  const urlObj = new URL(url);

  return new Promise(resolve => {
    dns.lookup(urlObj.host, err => {
      if (err) {
        return resolve(false);
      }

      resolve(true);
    });
  });
}

async function getExistingUrl(url) {
  const db = client.db(dbName);
  const shortUrls = db.collection("shorturls");

  try {
    return await shortUrls.findOne({ url: url });
  } catch (err) {
    throw err;
  }
}

async function getNewShortUrl() {
  const counterName = "shorturl";
  const db = client.db(dbName);
  const counters = db.collection("counters");

  try {
    return (await counters.findOneAndUpdate(
      { _id: counterName },
      { $inc: { nextVal: 1 } },
      { returnOriginal: false }
    )).value.nextVal;
  } catch (err) {
    throw err;
  }
}

async function saveShortUrl(shortUrl, url) {
  const db = client.db(dbName);
  const shortUrls = db.collection("shorturls");

  try {
    await shortUrls.insertOne({ _id: shortUrl, url: url });
    return;
  } catch (err) {
    throw err;
  }
}

async function createNewShortUrl(origUrl) {
  try {
    const isValid = await checkUrlValidity(origUrl);

    if (!isValid) {
      return { error: "invalid URL" };
    }

    const existingUrl = await getExistingUrl(origUrl);

    if (existingUrl && existingUrl._id) {
      const shortUrl = existingUrl._id;
      return { original_url: origUrl, short_url: shortUrl };
    }

    const shortUrl = await getNewShortUrl();
    await saveShortUrl(shortUrl, origUrl);

    return { original_url: origUrl, short_url: shortUrl };
  } catch (err) {
    console.log(err);
    return { error: "Unknown error" };
  }
}

async function getUrlByCode(code) {
  const db = client.db(dbName);
  const shortUrls = db.collection("shorturls");

  try {
    const result = await shortUrls.findOne({ _id: code });
    return result.url;
  } catch (err) {
    throw err;
  }
}
