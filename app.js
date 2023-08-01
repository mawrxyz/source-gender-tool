require("dotenv").config()

const express = require("express");
const bodyParser = require('body-parser');
const unirest = require("unirest");
const axios = require('axios');
const nlp = require('compromise')

// Set up Express framework
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.set("view engine", "ejs");

// Add API key 
const API_KEY = process.env.RANDOMER_API_TOKEN;

// Function to get gender of a given name
const getGender = async (name) => {
    const response = await axios.get(`https://api.genderize.io?name=${name}`);
    return response.data.gender;
}

// Probability of name being that gender 
const genderProb = async (name) => {
    const response = await axios.get(`https://api.genderize.io?name=${name}`);
    return response.data.probability;
}

// Scraping Google for LinkedIn results for job title

app.get("/", (req, res) => {
    res.render("index");
});

app.post('/scrape', async (req, res) => {
    let job_title = req.body.job_title;

    const getData = async () => {
        let employees_data = [];
        try {
            const url = `https://www.googleapis.com/customsearch/v1/siterestrict?key=${API_KEY}&cx=f14c5df87642c4566&q=site:uk.linkedin.com/in%20${job_title}%20(her%20OR%20she)&num=10`;

            const response = await unirest.get(url);

            const items = response.body.items;
            console.log(items);

            let count = 0;
            for (let item of items) {
                let heading = (item.pagemap.metatags[0]["twitter:title"]).replace('| LinkedIn', '');
                    heading = heading.replace('| Professional Profile', '');
                    heading = heading.replace(/Dr\.?\s+/i, ''); // Removing 'Dr' or 'Dr.' honourific which the Genderize API classifies as male
                let name = heading;
                let title = "";
                let company = "";

                if (heading.includes(" - ")) {
                    [name, ...titleParts] = heading.split(" - ");
                    console.log("Title Parts: ", titleParts);
                    title = titleParts[0];
                    if (titleParts.length > 1) {
                        company = titleParts[1];
                    } 
                }

                let about = item.pagemap.metatags[0]["og:description"];

                console.log('Name: ', name);
                console.log("Title: ", title)
                console.log("Company: ", company)
                console.log("About: ", about)

                let firstName = name.split(" ")[0];

                // INFERRING GENDER

                let gender = await getGender(firstName);
                let probability = await genderProb(firstName);

                if (gender === null) {
                    gender = 'Unclear (not defined)';
                }

                // Look for references to female pronouns in snippet for 'male' names in case name is gender neutral
                if (gender !== 'female' && probability < 1 && (((item.snippet).toLowerCase()).includes(' she ') | ((item.snippet).toLowerCase()).includes(' her '))) {
                    gender = 'Probably female (potentially gender neutral name)'; 
                }

                // Self-identified gender by pronouns takes precedence all of the above
                let identifyMale = (name.toLowerCase()).includes('(he/him)') | (name.toLowerCase()).includes('(he / him)');
                let identifyFemale = (name.toLowerCase()).includes('(she/her)') | (name.toLowerCase()).includes('(she / her)');
                let identifyNeutral = (name.toLowerCase()).includes('(they/them)') | (name.toLowerCase()).includes('(they / them)');

                if (identifyMale) {
                    gender = 'male';
                }

                if (identifyFemale) {
                    gender = 'female';
                }

                if (identifyNeutral) {
                    gender = 'neutral';
                }

                console.log('Gender: ', gender);
                console.log('Genderize probability: ', probability);

                if (gender === 'male') {
                    continue; // Skip men identified at this point
                }

                let sheRegex = /\bshe\b[\p{P}\s]?/giu;
                if (sheRegex.test(name.toLowerCase()) && !identifyFemale) {
                    continue; // Skip entries that are coming up just because 'she' is in the person's name (but may exclude actual women with that name)
                }

                // if (heading.includes(' SHE ')) {
                //     continue; // Skip entries where the company or job title includes SHE as an abbreviation for something
                // }

                if ((name.toLowerCase()).includes(job_title.toLowerCase())) {
                    continue; // Skip entries that come up just because the job title e.g. Carpenter/Cook/Baker/Ranger is also a surname
                }

                employees_data.push({
                    name: name,
                    title: title,
                    company: company,
                    gender: gender[0].toUpperCase() + gender.substring(1),
                    probability: probability,
                    about: about.substring(0, about.lastIndexOf(".") + 1), // Removing any trailing sentences in description
                    link: item.link
                });
                count++;
                if (count >= 5) {
                    break; //limit results to top 5
                }
            };
        } catch (e) {
            console.log(e);
        }
        console.log('Employees data: ', employees_data);
        return employees_data;
    };

    let employees_data = await getData();

    res.render("results", { employees_data: employees_data });
});

const port = 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));