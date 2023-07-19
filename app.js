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
            model: "gpt-3.5-turbo",
            messages: [
                {role: "system", content: `Given the text below, identify the individuals who are directly quoted in the text. IMPORTANT: Do not include the main newsmakers or subjects of the story, only those providing additional opinions. For each individual, provide their name, likely gender, and a description of their role in the story, which could be used to search for a similar individual in a search engine or LinkedIn. Where pronouns or honorifics indicating gender are used, state the gender accordingly (e.g. male, female or non-binary). Otherwise, make a guess based on the name or other contextual clues available. /n/n For the role, focus on aspects of their background or expertise that are relevant to the story. For example, if a person is quoted because they live in an area that is the subject of the story, their profession is not as important as the fact that they are a resident of the area. Avoid mentioning the company the person works at unless it is relevant to the story, as it is more likely that their professional expertise is why they were quoted, and people with similar expertise may not work at the same company. /n/n Return your response as an array of JavaScript object, with each object representing an individual. For example, if the three people contributing opinions to the article are "Tom Holland, senior political analyst at think tank XYZ", "Angeline Baker, marketing manager and resident of Cardiff city" and "Richard Tate, owner of local business The Beaver's Den", the response could be something like this:
                [
                    {
                        "name": "Tom Holland",
                        "gender": "male",
                        "role": "political analyst at a think tank"
                    },
                    {
                        "name": "Angeline Baker",
                        "gender": "female",
                        "profession": "resident of Cardiff city"
                    },
                    {
                        "name": "Richard Tate",
                        "gender": "male",
                        "profession": "local business owner"
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

    const getData = async () => {
        let employees_data = [];
        try {
            const url = `https://www.googleapis.com/customsearch/v1/siterestrict?key=${GOOGLE_KEY}&cx=f14c5df87642c4566&q=site:uk.linkedin.com/in%20${job_title}%20(her%20OR%20she)&num=10`;

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