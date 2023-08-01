require("dotenv").config()

const express = require("express");
const bodyParser = require('body-parser');
const unirest = require("unirest");
const axios = require('axios');
const { Configuration, OpenAIApi } = require("openai");

// Set up Express framework
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
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

// Probability of name being that gender 
const genderProb = async (name) => {
    const response = await axios.get(`https://api.genderize.io?name=${name}`);
    return response.data.probability;
}

// Scraping Google for LinkedIn results for job title

app.get("/", (req, res) => {
    res.render("index");
});

app.post('/detect', async (req, res) => {
    // Obtain the text to analyze from the request body
    let article_text = req.body.article_text;
    
    let perspectives_data = [];
    try {
        const response = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [
                {role: "system", content: `You will be provided with a block of text, and your task will be to extract the names of individuals who are directly quoted in the text, their gender, and their connection to the subject of the story or the reason for their inclusion in the story. Only include individuals who are providing supplementary comments or perspectives who could be replaced by others of similar background, experiences or expertise. 
                
                **Exclude individuals who are the main newsmaker(s) or subject(s) of the news article. Also, exclude individuals who are only mentioned in the text but do not provide direct quotes.**

                Describe their connection (or "role") in broad terms that explain why their perspectives are valuable to the story. This could be due to professional expertise, personal experiences, a shared background with the subject of the story, or any other aspect that makes their perspectives unique and irreplaceable. Unless it is crucial to their perspectives, do not mention specific company names or overly detailed job titles. 
                
                State the individual's gender based on pronouns or honorifics used in the text. If no clear indication is given, make an educated guess based on the name or other contextual clues.
                
                Please return your response as an array of JavaScript objects, with each object representing an individual. For example:
                [
                {
                "name": "Jane Doe",
                "gender": "female",
                "role": "senior political analyst at a think tank"
                },
                {
                "name": "John Doe",
                "gender": "male",
                "role": "resident of Cardiff city"
                }
                ]`},
                {role: "user", content: article_text}
            ],
            temperature: 0,
            max_tokens: 2000
        });

        console.log('Response data: ', response.data);
        console.log('Message content:', response.data.choices[0].message);

        // Parse the response from GPT-3 into a list of dictionaries
        let quotedIndividuals = JSON.parse(response.data.choices[0].message.content);

        for (let individual of quotedIndividuals) {
            // Process each individual's name, gender, and role separately
            let name = individual.name;
            let gender = individual.gender;
            let role = individual.role;

            perspectives_data.push({
                name: name,
                gender: gender,
                role: role
            });
        }

    } catch (e) {
        console.log(e);
    }

    console.log('Perspectives data: ', perspectives_data);
    res.json(perspectives_data);
});

app.post('/scrape', async (req, res) => {

    let job_title = req.body.job_title;
    let minority_gender = req.body.minority_gender;

    let url;

    if (minority_gender === 'female') {
        url = `https://www.googleapis.com/customsearch/v1/siterestrict?key=${GOOGLE_KEY}&cx=f14c5df87642c4566&q=site:uk.linkedin.com/in%20${job_title}%20(she%20OR%20her)&num=10`;
    } else if (minority_gender === 'male') {
        url = `https://www.googleapis.com/customsearch/v1/siterestrict?key=${GOOGLE_KEY}&cx=f14c5df87642c4566&q=site:uk.linkedin.com/in%20${job_title}%20(he%20OR%20him)&num=10`;
    } else {
        url = `https://www.googleapis.com/customsearch/v1/siterestrict?key=${GOOGLE_KEY}&cx=f14c5df87642c4566&q=site:uk.linkedin.com/in%20${job_title}&num=10`;
    }

    const getData = async () => {
        let employees_data = [];
        try {

            const response = await unirest.get(url);
            console.log("Profile response: ", response)

            const items = response.body.items;
            console.log("Profiles found: ", items);

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
                let identifyNeutral = (name.toLowerCase()).includes('(they/them)') | (name.toLowerCase()).includes('(they / them)') | (name.toLowerCase()).includes('(ze/hir/hirs)') | (name.toLowerCase()).includes('(ey/em/eir)');

                if (identifyMale) {
                    gender = 'male';
                }

                if (identifyFemale) {
                    gender = 'female';
                }

                if (identifyNeutral) {
                    gender = 'non-binary';
                }

                console.log('Gender: ', gender);
                console.log('Genderize probability: ', probability);

                if (gender !== minority_gender) {
                    continue; // Skip those that are not in the minority gender
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