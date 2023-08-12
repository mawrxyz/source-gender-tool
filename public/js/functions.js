// Get document elements
const sourceTable = document.getElementById('source_table');
const resultsPlaceholder = document.getElementById('results_placeholder');
const loadingSpinner = document.getElementById('loading-spinner');
const analyseButton = document.getElementById('analyse-button');
const resetButton = document.getElementById('reset-button');
const resultsStatementDiv = document.getElementById('results_statement');
const jobLinksDiv = document.getElementById('job_links');
const panel = document.getElementById("sidePanel");
const aboutButton = document.getElementById("aboutButton");
const articleText = document.getElementById('article_text');

// Toggle 'About' panel on click

let isPanelOpen = false; // variable to keep track of the panel state

function toggleNav(event) {
    event.stopPropagation();
    
    if (isPanelOpen) { // if the panel is open
        if (window.innerWidth <= 768) { // check if screen size is small
            panel.style.transform = "translateY(-100%)";
        } else {
            panel.style.transform = "translateX(-100%)";
        }
        aboutButton.style.left = "0";
        isPanelOpen = false;
    } else { // if the panel is closed
        if (window.innerWidth <= 768) { // check if screen size is small
            panel.style.transform = "translateY(0)";
        } else {
            panel.style.transform = "translateX(0%)";
        }
        aboutButton.style.left = window.innerWidth <= 768 ? "50%" : "28%";
        isPanelOpen = true;
    }
}

document.addEventListener('click', function(event) {

    if (isPanelOpen && event.target !== aboutButton) { // if the panel is open and the click target is not the button
        if (window.innerWidth <= 768) { // check if screen size is small
            panel.style.transform = "translateY(-100%)";
        } else {
            panel.style.transform = "translateX(-100%)";
        }
        aboutButton.style.left = "0";
        isPanelOpen = false;
    }
});

// Stop propagation of click events within the panel so it doesn't close when the panel is clicked
panel.addEventListener('click', function(event) {
    event.stopPropagation();
});
  
// Set the buttons as disabled if textbox is blank
document.addEventListener("DOMContentLoaded", function() {

    // Disable the buttons if textarea is empty
    analyseButton.disabled = !articleText.value.trim();
    resetButton.disabled = !articleText.value.trim();
});

// Add an event listener to the textarea to enable/disable the buttons based on whether there is input text
articleText.addEventListener('input', function() {

        // The "Analyse" button is disabled when the textarea is empty
        analyseButton.disabled = !this.value.trim();
        resetButton.disabled = !this.value.trim();
});

function resetApp() {

    console.log("Resetting app.");
    // Clear the text area
    articleText.value = '';

    // Clear the word count
    document.getElementById('wordCount').textContent = '0';

    // Clear the results
    sourceTable.innerHTML = '';
    resultsStatementDiv.style.display = 'none';
    resultsStatementDiv.style.backgroundColor = '#FFCD91';
    resultsStatementDiv.innerHTML = '';
    jobLinksDiv.style.display = 'none';
    jobLinksDiv.innerHTML = '';

    // Clear D3 chart
    d3.select("#chart").html("");
    
    // Disable the analyse button
    analyseButton.disabled = true;
    analyseButton.style.display = 'block';
    
    // Hide the loading spinner and display results placeholder
    loadingSpinner.style.display = 'none';
    resultsPlaceholder.style.display = 'block';
    
}

function countWords(textarea, display) {
    let text = textarea.value;
    let words = text.split(/\s+/).filter(function(word) { return word.length > 0; }); // split by spaces and remove empty words
    display.textContent = words.length;
    if (words.length > 1000) {
        words = words.slice(0, 1000); // limit words array to 1000 elements
        textarea.value = words.join(' '); // update textarea value with limited words
        display.textContent = words.length;
        display.style.color = '#CD0010';
    } else {
        display.style.color = '#212121';
    }
}

function formatPercentage(num) {
    return num % 1 === 0 ? Math.floor(num) : num.toFixed(2);
}

function loadingAnalysis() {

    console.log("Preparing to analyse text...");

    const elementsToClear = ['source_table', 'chart', 'results_statement', 'job_links'];
    for (const elementId of elementsToClear) {
        document.getElementById(elementId).innerHTML = '';
    }

    const elementsToHide = ['results_statement', 'job_links'];
    for (const elementId of elementsToHide) {
        document.getElementById(elementId).style.display = 'none';
    }

    // Disable analyse button while loading
    analyseButton.disabled = true;

    // Display the loading spinner and hide results placeholder
    loadingSpinner.style.display = 'block';
    resultsPlaceholder.style.display = 'none';
}

function getArticleText() {

    console.log("Retrieving text from user input...");

    const article_text = articleText.value;
    if (!article_text.trim()) {
        alert('Please enter some article text to analyse.');
        return null;
    }
    return article_text;
}

function analyseText(article_text) {

    console.log("Analysing text...");

    return fetch('/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_text: article_text })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json(); 
    })
    .catch(error => {

        console.log('Error while analysing text: ', error);
        // Display the error message in resultsStatementDiv
        resultsStatementDiv.innerHTML = `<p>Oops, something went wrong! Please make sure you have entered text that includes some quotes from individuals and try again.</p>`;
        resultsStatementDiv.style.display = 'block'; 
        resultsStatementDiv.style.backgroundColor = '#F4D4D5'; 
    });
}

function drawChart(genderData) {

    console.log("Drawing chart....");

    // Define the chart dimensions
    let margin = {top: 20, right: 20, bottom: 30, left: 50};
    let width = 600 - margin.left - margin.right;
    let height = 400 - margin.top - margin.bottom;

    // Clear previous chart if it exists
    d3.select("#chart").html("");

    // Create the SVG container for the chart
    let svg = d3.select("#chart").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top * 3)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top * 2})`);

    // Add title to the chart
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")
        .style("font-size", "1.3em")
        .text("Breakdown of Source Gender");

    // Create the x scale
    let x = d3.scaleBand()
        .domain(genderData.map(d => d.category))  // The range of the data (categories)
        .range([0, width])  // The range of the output (0 to width of chart)
        .padding(0.1);  // Space between bars

    // Create the y scale
    let y = d3.scaleLinear()
        .domain([0, Math.max(5, d3.max(genderData, d => d.count))])  // Max count of 5
        .range([height, 0]);  // The range of the output (height to 0 of chart)

    // Add the x-axis
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")  
        .style("font-size", "0.8rem");

    // Add the y-axis
    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d3.format("d")).ticks(5))
        .selectAll("text")  
        .style("font-size", "0.8rem");

    // Define the colors for each category
    let color = d3.scaleOrdinal()
        .domain(genderData.map(d => d.category))
        .range(["#733381", "#F58024", "#589C48"]);

    // Tooltip for percentages
    let tooltip = d3.select("#chart").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "1px")
        .style("border-radius", "5px")
        .style("padding", "10px");

    // Add the bars
    svg.selectAll(".bar")
        .data(genderData)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.category))
        .attr("y", d => y(d.count))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.count))
        .attr("fill", d => color(d.category))
        .on("mouseover", (event, d) => {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`<div style="text-align: center;"><b>${d.category.toUpperCase()}</b></div>
            Count: ${d.count}<br>Proportion of total: ${d.percentage}%`)
                .style("left", (event.pageX - tooltip.node().offsetWidth / 2) + "px")
                .style("top", (event.pageY - tooltip.node().offsetHeight - 10) + "px");
        })
        .on("mouseout", d => {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
}

let isRunning = false; // track whether async job suggestions function is already running to prevent multiple calls at the same time

async function sourceSuggestions(location, majorityJobs, majorityGender, minorityGender, jobContentsMap) {

    if (isRunning) return;

    isRunning = true;
    console.log("Source suggestions being generated...")

    const modal = document.getElementById('myModal');
    const modalBody = document.getElementById('modal_body');
    const closeModal = document.getElementsByClassName('close')[0];
    let ul = document.getElementById('job_links_ul');
    if (!ul) {
        ul = document.createElement('ul');
        ul.id = 'job_links_ul';
    }
    ul.innerHTML = '';
    const existingSuggestion = document.getElementById('source-suggestions-message');
    if (existingSuggestion) existingSuggestion.remove();

    // Add temporary "Generating source suggestions..." message
    const tempMessage = document.createElement('p');
    tempMessage.id = 'temp-message';  
    tempMessage.className = 'type-animation';  
    tempMessage.textContent = "Generating source suggestions...";  
    tempMessage.style.width = "20em";  
    jobLinksDiv.appendChild(tempMessage);

    try {
        for (let job of majorityJobs) {

            if (!jobContentsMap.has(job)) { // check if job already exists in results before retrieving to avoid duplicates
                const searchResponse = await fetch('/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ location: location, job_title: encodeURIComponent(job), minority_gender: minorityGender })
                });
    
                if (searchResponse.ok) {
                    const html = await searchResponse.text();
                    // If there are no results, don't generate a link for this job.
                    if (html.trim().length === 0) {
                        continue;
                    }
                    // Save the fetched HTML in the map for future use.
                    jobContentsMap.set(job, html);
                } else {
                    console.error(`Error searching for profiles matching "${job}": ${searchResponse.status} ${searchResponse.statusText}`);
                    continue;
                }
            }
            
            // Generate and format links for jobs where matching profiles are found
            const li = document.createElement('li');
            const jobLink = document.createElement('a');
            jobLink.href = '#';
            jobLink.textContent = job;
            jobLink.className = 'jobLinks';
            jobLink.addEventListener('click', (event) => {
                event.preventDefault();
                modalBody.innerHTML = jobContentsMap.get(job);
                modal.style.display = 'block';
            });
            li.appendChild(jobLink);
            if (!Array.from(ul.children).some(li => li.textContent.trim() === job)) { // check again for duplicates in the list
                console.log("Adding source suggestions for ", job, "...");
                ul.appendChild(li);
            }
        }
        
        if (ul.children.length > 0 && !document.getElementById('source-suggestions-message')) { // show this paragraph only if there are suggestions generated
            const source_suggestions = document.createElement('p');
            source_suggestions.id = 'source-suggestions-message';  

            let locationStatement = (location && location !== "unknown") ? `This story appears to be about or set in ${location}. Click on each link below to look for LinkedIn profiles of ${minorityGender.toLowerCase()} sources that might have background and experience in ${location} and ` : `Click on each link below to look for LinkedIn profiles of ${minorityGender.toLowerCase()} sources that might have `;
            source_suggestions.innerHTML = `If it makes sense in the context of the story, you might want to consider looking for more ${minorityGender.toLowerCase()} sources. ${locationStatement}professional roles similar to the ${majorityGender.toLowerCase()} sources quoted:`;
            jobLinksDiv.appendChild(source_suggestions);
        } else {
            const no_suggestions= document.createElement('p'); // show this paragraph if there is imbalance but no relevant suggestions
            no_suggestions.innerHTML = `The ${majorityGender.toLowerCase()} sources quoted in this text may play a personal or highly specific role in the story and therefore be hard to replace with other sources. Nonetheless, you might want to consider including more ${minorityGender.toLowerCase()} perspectives.`
            jobLinksDiv.appendChild(no_suggestions);
        }
    
        if (!jobLinksDiv.contains(ul)) {
            jobLinksDiv.appendChild(ul);
        }
    } catch (error) {
        console.error('Error generating source suggestions:', error);
     }
    

    // When the user clicks on <span> (x), close the modal
    closeModal.onclick = function() {
        modal.style.display = 'none';
    }

    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }
    isRunning = false;

    const messageToRemove = document.getElementById('temp-message');
    if (messageToRemove) {
        messageToRemove.remove();
    }
}

function generateResultsTable(data) {

    console.log("Generating table of sources...");

    tableHTML = '';
        tableHTML += '<table class = "source-table"><tr><th>Source</th><th>Gender</th><th>Role</th><th>Quotes</th></tr>';

        for (let person of data) {
            tableHTML += `<tr>
                <td>${person.name}</td>
                <td>${person.gender} <span class="info-icon"><i class="fas fa-info-circle"></i><span class="table-tooltip">${person.reasons}</span></span></td>
                <td>${person.role}</td>
                <td>${person.quotes}</td>
            </tr>`;
        }
        tableHTML += '</table>';
        
        // Insert the HTML into the source_table div
        sourceTable.innerHTML = tableHTML;   
        
        // Set up the tooltip behavior
        $('.info-icon').hover(function(){
            $(this).find('.table-tooltip').css("opacity", 1).fadeIn(500);
        }, function(){
            $(this).find('.table-tooltip').css("opacity", 0).fadeOut(500);
        });
}

function displayResults(response) {

    console.log("Displaying results...");

    let location = response.location.location || 'unknown';

    console.log('The location is: ', location);

    let data = response.perspectives_data;
    console.log('Source data found: ', data);

    let totalSources = data.length;

    let maleCount = data.filter(person => person.gender === 'Male').length;
    let femaleCount = data.filter(person => person.gender === 'Female').length;
    let unknownCount = data.filter(person => person.gender !== 'Male' && person.gender !== 'Female').length;

    let malePercentage = ((maleCount / totalSources) * 100).toFixed(2);
    let femalePercentage = ((femaleCount / totalSources) * 100).toFixed(2);
    let unknownPercentage = ((unknownCount / totalSources) * 100).toFixed(2);

    let minorityGender, majorityGender;

    // Generating the summary of results

    if (totalSources === 0) {
        resultsStatementDiv.innerHTML = "There were no sources detected in the text, or the only sources quoted are the main newsmaker(s) or subject(s) of the story. If you think this is wrong, please click on the 'Reset' button and try again.";
        resultsStatementDiv.style.display = 'block';
        resultsStatementDiv.style.backgroundColor = "#F4D4D5";
        // Hide the loading spinner 
        loadingSpinner.style.display = 'none';
    } else {

        if (unknownCount > 0 && maleCount === 0 && femaleCount === 0)  {
            resultsStatementDiv.innerHTML = "We were not able to confidently determine the gender of any sources quoted.";
            resultsStatementDiv.style.backgroundColor = '#FFCD91';
            jobLinksDiv.innerHTML = `<p>Gender is complex and not limited to "male" or "female". Furthermore, naming conventions vary by culture and individual preference, so it is not always possible to accurately determine the gender of a person by their name alone.</p><p>Nonetheless, it is always good to try to get a good balance of voices in your story.</p>`;
        } else {
            if (malePercentage > femalePercentage) {
                minorityGender = 'Female';
                majorityGender = 'Male';
                resultsStatementDiv.textContent = `There are more men than women quoted in your story.`;
                resultsStatementDiv.style.backgroundColor = '#FFCD91'; 
                jobLinksDiv.innerHTML = `<p>There ${maleCount === 1 ? 'was' : 'were'} <b>${maleCount} ${maleCount === 1 ? 'man' : 'men'}</b> and <b>${femaleCount} ${femaleCount === 1 ? 'woman' : 'women'}</b> quoted as additional sources in your story.</p>`
            } else if (malePercentage === femalePercentage) {
                resultsStatementDiv.textContent = "There is a perfect balance of men and women quoted in your story. Great job!";
                resultsStatementDiv.style.backgroundColor = "#A4D1A2";
            } else {
                minorityGender = 'Male';
                majorityGender = 'Female';
                resultsStatementDiv.textContent = `There are more women than men quoted in your story.`;
                resultsStatementDiv.style.backgroundColor = '#FFCD91';
                jobLinksDiv.innerHTML = `<p>There ${femaleCount === 1 ? 'was' : 'were'} <b>${femaleCount} ${maleCount === 1 ? 'woman' : 'women'}</b> and <b>${maleCount} ${maleCount === 1 ? 'man' : 'men'}</b> quoted as additional sources in your story.</p><p>Women <a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8242240/" target="_blank">tend to be</a> quoted more on topics such as lifestyle, entertainment, and healthcare, while men tend to feature more in articles about sports, politics, and business. Unless the story is specifically about women or men, it is often desirable to try to get a good balance of voices.</p>`
            }
        }

        // Where there is an imbalance, extract the roles of anyone from the majority gender quoted in a professional role

        if (majorityGender != null) {
                
            let majorityJobs = [];

            for (let person of data) {
                if (person.gender === majorityGender && person.linkedin === 'yes') {
                    majorityJobs.push(person.role);
                }
            }

            majorityJobs = [...new Set(majorityJobs)]; // remove any duplicates

            if (majorityJobs.length != 0) {  
                const jobContentsMap = new Map(); // object to store results each time link clicked so it doesn't have to re-run if clicked again
                sourceSuggestions(location, majorityJobs, majorityGender, minorityGender, jobContentsMap);
            } else {
                jobLinksDiv.innerHTML += `<p>The ${majorityGender.toLowerCase()} sources quoted in this text may play a personal or highly specific role in the story and therefore be hard to replace with other sources. Nonetheless, you might want to consider including more ${minorityGender.toLowerCase()} perspectives.</p>`
            }
        }

        let genderData = [
            {category: 'Men', count: maleCount, percentage: malePercentage},
            {category: 'Women', count: femaleCount, percentage: femalePercentage},
            {category: 'Others/unknown', count: unknownCount, percentage: unknownPercentage}
        ];
    
        drawChart(genderData);
    
        generateResultsTable(data);

        console.log("Done analysing text!");

        // Show elements after everything is done loading
        resultsStatementDiv.style.display = 'block';
        jobLinksDiv.style.display = 'block';
        
        // Hide the loading spinner 
        loadingSpinner.style.display = 'none';
    }
}

function analyseArticle() {
    loadingAnalysis();
    const article_text = getArticleText();
    if (!article_text) {
        return;
    }
    analyseText(article_text)
        .then(displayResults)
        .catch(error => {
            console.error('Error analysing text:', error);
            resultsStatementDiv.innerHTML = `<p>Oops, something went wrong! Please make sure you have entered text that includes some quotes from individuals and try again.</p>`;
            resultsStatementDiv.style.display = 'block'; 
            resultsStatementDiv.style.backgroundColor = '#F4D4D5'; 
            // Hide the loading spinner and enable the analyse button in case of an error
            loadingSpinner.style.display = 'none';
            analyseButton.disabled = false;

        });
}

// Add the event listener to the "Analyse" button
analyseButton.addEventListener('click', function() {
    analyseArticle();
});

// Add the event listener to the "Reset" button
resetButton.addEventListener('click', function() {
    resetApp();
});