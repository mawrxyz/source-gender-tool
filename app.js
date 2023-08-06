require("dotenv").config()

const express = require("express");
const app = express();
const basicAuth = require('express-basic-auth')
const unirest = require("unirest");
const axios = require('axios');
const { Configuration, OpenAIApi } = require("openai");

// Set up password authentication

app.use(basicAuth({
    users: { [process.env.AUTH_USERNAME]: process.env.AUTH_PASSWORD },
    challenge: true
}))


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

// Probability of name being that gender 
const genderProb = async (name) => {
    const response = await axios.get(`https://api.genderize.io?name=${name}`);
    return response.data.probability;
}

app.get("/", (req, res) => {
    res.render("index");
});

app.post('/detect', async (req, res) => {
    // Obtain the text to analyze from the request body
    let article_text = req.body.article_text;
    
    let location = null;
    let perspectives_data = [];
    try {
        const response = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [
                {role: "system", content: `You will be provided with a block of text. Your first task is to identify the location that the story is situated. Your second task will be to extract the names of individuals who are quoted as saying something in the text, their gender, and their connection to the subject of the story or the reason for their inclusion in the story. 
                
                **IMPORTANT: Only include individuals who are providing supplementary comments or perspectives who could be replaced by others of similar background, experiences or expertise. Exclude individuals who are the main subject(s) of the news article. Also, exclude individuals who are only mentioned but do not provide quotes.**

                Describe each individual's connection (or "role") in broad terms that explain why their perspectives are valuable to the story. This could be, for example, due to professional expertise, personal experiences or a shared background with other people mentioned in the story. Do not mention specific company names or overly detailed job titles, unless these details are key to the person's role in the story. 
                
                If the role is a professional one, phrase the result such that someone with a similar background or expertise could be found by searching for the role on a job site like LinkedIn, and put "yes" as the value for the key "linkedin". Otherwise, if the role is highly personal such as the relative of the main subject or a resident of a city, put "no" for the key "linkedin". 
                
                State the individual's gender based on pronouns or honorifics used in reference to that individual (NOT anyone else they mention in their quote). If no clear indication is given, make an educated guess based on the name or other contextual clues. If it is ambiguous, such as if the name is gender neutral, the pronoun "they" is used to reference an individual, or there are no pronouns or honorifics used, state the gender as "unknown". Briefly provide reasons for your determination of the person's gender.

                Extract the quotes that are used, with each line containing a direct or indirect quote presented as a list item with the exact wording used in the text. There must be at least one quote for each individual included. Otherwise, omit that individual. 
                
                Please return your response as an array of JavaScript objects using British spelling, with each object representing an individual. For example:
                [
                {"location": "Cardiff"},
                {
                "name": "Jane Doe",
                "gender": "Female",
                "reasons": "Jane is a common female name. The honorific "Ms" and the pronoun "she" are also used to refer to Jane.",
                "role": "Senior political analyst at a think tank",
                "linkedin": "yes",
                "quotes": "<ul><li>Jane Doe, a senior political analyst at US think tank Think Politics, said this was a 'highly concerning' situation.</li><li>'It is hard to say which way this will go,' she added.</li></ul>"
                },
                {
                "name": "Robin Doe",
                "gender": "Male",
                "reasons": "Robin is a unisex name, but the use of the pronoun "he" indicates this source is likely to be male.",
                "role": "Resident of Cardiff city",
                "linkedin": "no",
                "quotes": "<ul><li>Cardiff resident Robin Doe said he largely supported the city's policies regarding sustainable energy.</li></ul>"
                },
                "name": "Unnamed spokesman",
                "gender": "Male",
                "reasons": "The term "spokesman" tends to indicate a spokesperson of male gender.",
                "role": "Spokesperson for the Welsh government",
                "linkedin": "yes",
                "quotes": "<ul><li>'We are looking into the matter,' a spokesman for the Welsh government said.</li></ul>"
                },
                "name": "Alex Tan",
                "gender": "Unknown",
                "reasons": "Although Alex is more often associated with men, it can also be a female name. "They" as a singular pronoun is often used by nonbinary people.",
                "role": "Defence lawyer",
                "linkedin": "no",
                "quotes": "<ul><li>'My client is innocent, and we will shortly provide new evidence that will prove it,' her lawyer Alex Tan said. They added that the accused looked forward to seeing her family again.</li></ul>"
                }
                ]`},
                {role: "user", content: article_text}
            ],
            temperature: 0,
            max_tokens: 2000
        });

        console.log('Response data: ', response.data);
        console.log('Message content:', response.data.choices[0].message);

        // Parse the response from GPT-4 into location and quoted individuals data
        let data = JSON.parse(response.data.choices[0].message.content);
        location = data[0];
        let quotedIndividuals = data.slice(1);

        for (let individual of quotedIndividuals) {
            // Process each individual's name, gender, and role separately
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

    console.log('Location: ', location, '/nPerspectives data: ', perspectives_data);
    res.json({perspectives_data, location});
});

app.post('/scrape', async (req, res) => {

    let location = req.body.location;
    let job_title = req.body.job_title;
    let minority_gender = req.body.minority_gender.toLowerCase();

    let url;

    if (minority_gender === 'female') {
        url = `https://www.googleapis.com/customsearch/v1/siterestrict?key=${GOOGLE_KEY}&cx=f14c5df87642c4566&q=${job_title}%20AND%20${location}%20(she%20OR%20her)&num=10`;
    } else if (minority_gender === 'male') {
        url = `https://www.googleapis.com/customsearch/v1/siterestrict?key=${GOOGLE_KEY}&cx=f14c5df87642c4566&q=${job_title}%20AND%20${location}%20(he%20OR%20him)&num=10`;
    } else {
        url = `https://www.googleapis.com/customsearch/v1/siterestrict?key=${GOOGLE_KEY}&cx=f14c5df87642c4566&q=${job_title}%20${location}&num=10`;
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
                    heading = heading.replace(/Dr\.?\s+/i, ''); // Removing 'Dr' or 'Dr.' honorific which the Genderize API classifies as male
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
            return res.status(500).render('results', { error: e.message });
        }
        console.log('Employees data: ', employees_data);
        return employees_data;
    };

    let employees_data = await getData();

    res.render("results", { location: location, employees_data: employees_data, job_title: job_title, minority_gender: minority_gender });
});

const port = 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));