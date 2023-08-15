# EquiQuote: Using GPT-4 to Identify Gender Gaps in News Reporting

This repository contains code for an application called EquiQuote, which automatically detects a story’s sources from articles entered into a text field and suggests alternative sources if there is a gender imbalance. It focuses on additional sources: people quoted who are not the main subject or newsmaker. 

The tool uses OpenAI's [GPT-4](https://openai.com/research/gpt-4) language model to identify sources as well as assess the balance of women and men quoted as additional sources in a story. It also uses Google's [Custom Search JSON API](https://developers.google.com/custom-search/v1/overview) to search for LinkedIn profiles of sources that could have similar background and expertise to those already quoted.

Men are [quoted more often than women](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8242240/) in the news on average, although women tend to be quoted more on topics such as lifestyle, entertainment and healthcare. The uneven representation of sources can reinforce gender stereotypes. 

The purpose of this tool is to automate the detection of source gender in news stories, and nudge journalists to reflect on source diversity in their reporting before their stories are published. By providing suggestions for the LinkedIn profiles of alternative sources, EquiQuote also offers a starting point to correct any gender imbalances.

## Project Owner

I'm [Melissa Zhu](https://www.linkedin.com/in/melissa-zhu/), a journalist from Singapore. EquiQuote is my 2023 dissertation project for my Master of Science in Computational and Data Journalism at Cardiff University. 

## How to Use This Code

This repository is licensed under the [GNU General Public License v3.0](https://choosealicense.com/licenses/gpl-3.0/). A copy of the licence is available at `LICENSE.md`.

This tool uses [Node.js](https://nodejs.org/en/), so you will need to have it installed to run the code.

### Installation Steps:

1. **Clone the Repository**:
    ```bash
    git clone https://github.com/mawrxyz/source-gender-tool.git
    ```

2. **Navigate to the Directory and Install Dependencies**:
    ```bash
    cd source-gender-tool
    npm install
    ```

3. **Setup API Keys**:  
    - You will need your own API keys for both a [paid OpenAI account](https://openai.com/pricing) and Google's [Custom Search JSON API](https://developers.google.com/custom-search/v1/overview). It is important that you keep these keys private to avoid hitting usage limits or unauthorised users making potentially expensive API calls to GPT-4.
    - Store these keys in a `.env` file by copying the example file:
        ```bash
        cp .env.example .env
        ```
    - Edit the `.env` file with your API keys.

4. **Run the Application**:
    ```bash
    npm start
    ```

**Note**: If `NODE_ENV=development` is in the `.env` file, there's no need for authentication. However, for online hosting, consider adding password protection by updating the `.env` file and adjusting authentication details in `app.js`.

## Known Limitations

Gender is complex, but for simplicity this tool focuses on binary categorisations of "male" and "female". It is not possible to achieve 100% accuracy in identifying a source's gender without asking them, so this tool is only meant to provide an estimate of the gender breakdown in stories based on pronouns, honorifics, names and other contextual clues. 

GPT-4 aims to mimic natural human language and can produce unpredictable responses. While I've optimised the prompt to achieve consistent outputs, there's no guarantee of it always performing as expected.

The source suggestions are based on a custom Google search targeting [LinkedIn](https://www.linkedin.com/), with professional roles of sources already present in the text, the location of the story as well as the pronouns of the underrepresented gender, if any. This is quite a simple approach to looking for alternative sources, equivalent of a journalist doing a preliminary search online. I recognise that not all good alternatives would show up in such a search, and not all of the results would be relevant. It is meant to provide inspiration and a gentle nudge towards looking for more sources rather than serve as an exhaustive resource. 

## Future Development

EquiQuote currently demonstrates a basic implementation of how gender source detection and alternative source suggestions could be automated. An ideal future iteration would be integrating some of its functionalities into a Content Management System (CMS) to provide real-time feedback prior to publication. It could also be linked to a database to collect longitudinal data on the gender source balance of a publication or journalist's stories over time. 

## Acknowledgements

This project has been inspired and informed by many prior projects, including but not limited to the BBC's [50:50 project](https://www.bbc.co.uk/5050), the [Global Media Monitoring Project](https://www.unesco.org/en/world-media-trends/global-media-monitoring-project-gmmp) and the [Gender Gap Tracker](https://gendergaptracker.research.sfu.ca/). 

## Contribution and Feedback

If you have any feedback and or would like to discuss collaboration on this project, please contact me at [mel.zxy@gmail.com](mailto:mel.zxy@gmail.com). 
