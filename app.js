/* This file is part of EquiQuote, a tool to detect gender imbalances in news reporting.

Copyright (C) 2023 Melissa Zhu

EquiQuote is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

EquiQuote is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with EquiQuote.  If not, see <https://www.gnu.org/licenses/>. */

require("dotenv").config()

const express = require("express");
const app = express();
const basicAuth = require('express-basic-auth')
const unirest = require("unirest");
const axios = require('axios');
const { Configuration, OpenAIApi } = require("openai");

// Set up password authentication

let users = {
    [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD,
    [process.env.TEST_USERNAME]: process.env.TEST_PASSWORD,
}

if (process.env.NODE_ENV !== 'development') {
    app.use(basicAuth({
        users: users,
        challenge: true,
        unauthorizedResponse: 'Unauthorised'
    }))
}

// Configure app
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.set("view engine", "ejs");

// Configure OpenAI 
const configuration = new Configuration({
    apiKey: process.env.OPEN_AI_KEY,
});

const openai = new OpenAIApi(configuration);

// API key for Google search
const GOOGLE_KEY = process.env.GOOGLE_KEY;

// Function to get gender of a given name
const getGender = async (name) => {
    const response = await axios.get(`https://api.genderize.io?name=${name}`);
    return response.data.gender;
}

app.get("/", (req, res) => {
    res.render("index");
});

app.post('/detect', async (req, res) => {
    // Obtain the text to analyse from the request body
    let article_text = req.body.article_text;
    
    let location = null;
    let perspectives_data = [];
    let error = null; 
    let data; 
    try {
        const response = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [
                {role: "system", content: `You will be provided with a block of text. Your first task is to identify where the story takes place (or "location"), if this information is available (if not, return {location: null} as the first item in the response array). The location could be a city, town, region or country but not a specific landmark. Your second task will be to identify individuals who are quoted as saying something in the text, including their name if available, their gender, and their connection to the subject of the story or the reason for their inclusion in the story. If the individual is unnamed, provide whatever identifying description is given e.g. "A government source" or "An unnamed resident".
                
                **IMPORTANT: Only include individuals who are providing supplementary comments or perspectives who could be replaced by others of similar background, experiences or expertise. Exclude individuals who are the main subject(s) of the news article. Also, exclude individuals who are only mentioned but do not provide quotes.**

                Describe each individual's connection (or "role") in broad terms that explain why their perspectives are valuable to the story. This could be, for example, due to professional expertise, personal experiences or a shared background with other people mentioned in the story. Do not mention specific company names or overly detailed job titles, unless these details are key to the person's role in the story. 
                
                If the role is a professional one, phrase the result such that someone with similar background or expertise could be found by searching for the role on a job site like LinkedIn, and put "yes" as the value for the key "linkedin". Otherwise put "no" for the key "linkedin" if the role is highly personal such as the relative of the main subject or a resident of a city, or the person's title is highly specific such as the Minister in charge of the area the story is about, whose perspective would be hard to replace. 
                
                State the individual's "gender" based on names, pronouns, gendered honorifics used in reference to that individual (NOT anyone else they mention in their quote) or other contextual clues. However, do not make any assumptions based on job titles or honorifics that could apply to both genders. If it is ambiguous, such as if the name is gender neutral, the pronoun "they" is used to reference an individual, or there are no pronouns or honorifics used, state the gender as "unknown". Under "reasons", briefly summarise the relevant factors for your determination of the person's gender.

                Extract the quotes that are used, with each line containing a direct or indirect quote presented as a list item with the exact wording used in the text. There must be at least one quote for each individual included. Otherwise, omit that individual. 
                
                Please return your response as an array of JavaScript objects in British English, with the first object representing the location and each subsequent object representing an individual. For example:
                [{"location": "Cardiff, Wales"},
                {
                    "name": "Jane Doe",
                    "gender": "Female",
                    "reasons": "Jane is a common female name. The honorific "Ms" and the pronoun "she" are also used to refer to Jane.",
                    "role": "Senior political analyst at a think tank",
                    "linkedin": "yes",
                    "quotes": "<ul><li>Jane Doe, a senior political analyst at US think tank Think Politics, said this was a 'highly concerning' situation.</li><li>'It is hard to say which way this will go,' she added.</li></ul>"
                },
                {
                    "name": "Robin Smith",
                    "gender": "Male",
                    "reasons": "The use of the pronoun "he" indicates this source is likely to be male.",
                    "role": "Resident of Cardiff city",
                    "linkedin": "no",
                    "quotes": "<ul><li>Cardiff resident Robin Smith said he largely supported the city's policies regarding sustainable energy.</li></ul>"
                },
                {
                    "name": "Unnamed spokesman",
                    "gender": "Male",
                    "reasons": "The term "spokesman" tends to indicate a spokesperson of male gender.",
                    "role": "Spokesperson for the Welsh government",
                    "linkedin": "yes",
                    "quotes": "<ul><li>'We are looking into the matter,' a spokesman for the Welsh government said.</li></ul>"
                },
                {
                    "name": "Liu Chen",
                    "gender": "Unknown",
                    "reasons": ""They" as a singular pronoun is often used by nonbinary people.",
                    "role": "Defence lawyer",
                    "linkedin": "no",
                    "quotes": "<ul><li>'My client is innocent, and we will shortly provide new evidence that will prove it,' her lawyer Liu Chen said. They added that the accused looked forward to seeing her family again.</li></ul>"
                }]`},
                {role: "user", content: article_text}
            ],
            temperature: 0,
            max_tokens: 2500
        });

        // Parse the response from GPT-4 into location and quoted individuals data
        try {
            let assistantOutput = response.data.choices[0].message.content;
            assistantOutput = assistantOutput.replace(/\\'/g, "'");
            assistantOutput = assistantOutput.trim();

            try {

                if (assistantOutput.charCodeAt(0) === 0xFEFF) {
                    assistantOutput = assistantOutput.slice(1);
                }
                if (typeof assistantOutput === "string") {
                    data = JSON.parse(assistantOutput);
                } else {
                    data = assistantOutput;
                }
            } catch (error) {
                if (assistantOutput.charAt(0) !== '[') {
                    assistantOutput = assistantOutput.slice(1, -1);
                }
        
                // Split the remaining string into separate strings
                let assistantOutputParts = assistantOutput.split(/},\n\n?{/);
        
                // Add back the leading and trailing curly braces {} to each string and parse each string into an object
                data = assistantOutputParts.map(part => JSON.parse('{' + part + '}'));
            }
        } catch (e) {
            console.log(e);
        }

        location = data[0];
        let quotedIndividuals = data.slice(1);

        for (let individual of quotedIndividuals) {
            let name = individual.name;
            let gender = individual.gender;
            let reasons = individual.reasons;
            let role = individual.role;
            let linkedin = individual.linkedin;
            let quotes = individual.quotes;

            perspectives_data.push({
                name: name,
                gender: gender,
                reasons: reasons,
                role: role,
                linkedin: linkedin,
                quotes: quotes
            });
        }
    } catch (e) {
        console.log(e);
    }

    res.json({perspectives_data, location, error});
});

function buildSearchURL(job_title, location, minority_gender, restricted = true) {
    let base = `https://www.googleapis.com/customsearch/v1${restricted ? '/siterestrict' : ''}`; // preferentially use Custom Search Site Restricted JSON API which has no daily query limit
    let pronouns = "";
    if (minority_gender === 'female') {
        pronouns = `%20(she%20OR%20her)`;
    } else if (minority_gender === 'male') {
        pronouns = `%20(he%20OR%20him)`;
    }
    return `${base}?key=${GOOGLE_KEY}&cx=f14c5df87642c4566&q=${job_title}%20AND%20${location}%20${pronouns}&num=10`;
}

async function processSearchResponse(response, job_title, minority_gender) {
    let employees_data = [];
    const items = response.body.items;
    let count = 0;
            for (let item of items) {
                let heading = (item.pagemap.metatags[0]["twitter:title"]).replace('| LinkedIn', '');
                    heading = heading.replace('| Professional Profile', '');
                    heading = heading.replace(/Dr\.?\s+/i, ''); // remove 'Dr' or 'Dr.' honorific which the Genderize API classifies as male
                let name = heading;
                let title = "";
                let company = "";

                if (heading.includes(" - ")) {
                    [name, ...titleParts] = heading.split(" - ");
                    title = titleParts[0];
                    if (titleParts.length > 1) {
                        company = titleParts[1];
                    } 
                }

                let about = item.pagemap.metatags[0]["og:description"];

                let firstName = name.split(" ")[0];

                // Infer gender using genderize.io and pronouns
                let gender = await getGender(firstName);

                // Self-identified gender by pronouns overrides genderize.io judgment
                let identifyMale = (name.toLowerCase()).includes('(he/him)') | (name.toLowerCase()).includes('(he / him)');
                let identifyFemale = (name.toLowerCase()).includes('(she/her)') | (name.toLowerCase()).includes('(she / her)');

                if (identifyMale) {
                    gender = 'male';
                }

                if (identifyFemale) {
                    gender = 'female';
                }

                if (gender !== minority_gender) {
                    continue; // Skip those that are not in the minority gender
                }

                let sheRegex = /\bshe\b[\p{P}\s]?/giu;
                if (sheRegex.test(name.toLowerCase()) && !identifyFemale) {
                    continue; // Skip entries that are coming up just because 'she' is in the person's name (but may exclude actual women with that name)
                }

                if ((name.toLowerCase()).includes(job_title.toLowerCase())) {
                    continue; // Skip entries that come up just because the job title e.g. Carpenter/Cook/Baker/Ranger is also a surname
                }

                employees_data.push({
                    name: name,
                    title: title,
                    company: company,
                    gender: gender[0].toUpperCase() + gender.substring(1),
                    about: about.substring(0, about.lastIndexOf(".") + 1), // Removing any trailing sentences in description
                    link: item.link
                });
                count++;
                if (count >= 5) {
                    break; //limit results to top 5
                }
            }
            return employees_data;
        }

app.post('/search', async (req, res) => {

    let location = req.body.location;
    let job_title = req.body.job_title;
    let minority_gender = req.body.minority_gender.toLowerCase();

    const getData = async () => {
        let employees_data = [];
        try {
            let url = buildSearchURL(job_title, location, minority_gender);
            let response = await unirest.get(url);

            if (response.status === 429) {
                url = buildSearchURL(job_title, location, minority_gender, false);
                response = await unirest.get(url);
            }
            employees_data = await processSearchResponse(response, job_title, minority_gender);
        } catch (e) {
            return res.status(500).render('results', { error: e.message });
        }
        return employees_data;
    };

    let employees_data = await getData();

    res.render("results", { location: location, employees_data: employees_data, job_title: job_title, minority_gender: minority_gender });
});

const port = 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));