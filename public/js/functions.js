// Get elements
const sourceTable = document.getElementById('source_table');
const loadingSpinner = document.getElementById('loading-spinner');
const analyseButton = document.getElementById('analyse-button');
const resultsStatementDiv = document.getElementById('results_statement');
const jobLinksDiv = document.getElementById('job_links');

// Toggle 'About' panel on click

let isPanelOpen = false; // this variable will keep track of the panel state

function toggleNav(event) {
    event.stopPropagation();
    const panel = document.getElementById("sidePanel");
    const button = document.getElementById("aboutButton");

    if (isPanelOpen) { // if the panel is open
        if (window.innerWidth <= 768) { // check if screen size is small
            panel.style.transform = "translateY(-100%)";
        } else {
            panel.style.transform = "translateX(-100%)";
        }
        button.style.left = "0";
        isPanelOpen = false;
    } else { // if the panel is closed
        if (window.innerWidth <= 768) { // check if screen size is small
            panel.style.transform = "translateY(0)";
        } else {
            panel.style.transform = "translateX(0%)";
        }
        button.style.left = window.innerWidth <= 768 ? "50%" : "28%";
        isPanelOpen = true;
    }
}

document.addEventListener('click', function(event) {
    const panel = document.getElementById("sidePanel");
    const button = document.getElementById("aboutButton");

    if (isPanelOpen && event.target !== button) { // if the panel is open and the click target is not the button
        if (window.innerWidth <= 768) { // check if screen size is small
            panel.style.transform = "translateY(-100%)";
        } else {
            panel.style.transform = "translateX(-100%)";
        }
        button.style.left = "0";
        isPanelOpen = false;
    }
});

// Stop propagation of click events within the panel so it doesn't close when the panel is clicked
document.getElementById('sidePanel').addEventListener('click', function(event) {
    event.stopPropagation();
});
  
// Set the buttons as disabled if textbox is blank
document.addEventListener("DOMContentLoaded", function() {
    const analyseButton = document.getElementById('analyse-button');
    const resetButton = document.getElementById('reset-button');
    const articleText = document.getElementById('article_text');

    // Disable the buttons if textarea is empty
    analyseButton.disabled = !articleText.value.trim();
    resetButton.disabled = !articleText.value.trim();
});

// Add an event listener to the textarea to enable/disable the buttons based on wether there is input text
document.getElementById('article_text').addEventListener('input', function() {
        const analyseButton = document.getElementById('analyse-button');
        const resetButton = document.getElementById('reset-button');

        // The "Analyse" button is disabled when the textarea is empty
        analyseButton.disabled = !this.value.trim();
        resetButton.disabled = !this.value.trim();
});

function resetArticle() {
    // Clear the text area
    document.getElementById('article_text').value = '';

    // Clear the word count
    document.getElementById('wordCount').textContent = '0';

    // Clear the results
    document.getElementById('source_table').innerHTML = '';
    document.getElementById('results_statement').style.display = 'none';
    document.getElementById('results_statement').style.backgroundColor = '#FFCD91';
    document.getElementById('results_statement').innerHTML = '';
    document.getElementById('job_links').style.display = 'none';
    document.getElementById('job_links').innerHTML = '';

    // Clear D3 chart
    d3.select("#chart").html("");
    
    // Disable the analyse button
    document.getElementById('analyse-button').disabled = true;
    document.getElementById('analyse-button').style.display = 'block';
    
    // Hide the loading spinner
    document.getElementById('loading-spinner').style.display = 'none';
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

    // Display the loading spinner
    loadingSpinner.style.display = 'block';
}

function getArticleText() {
    const article_text = document.getElementById('article_text').value;
    if (!article_text.trim()) {
        alert('Please enter some article text to analyse.');
        return null;
    }
    return article_text;
}

function analyseText(article_text) {
    return fetch('/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_text: article_text })
    });
}

function processResponse(response) {
    if (!response.ok) { throw response }
    return response.json();
}

function drawChart(genderData) {

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

function jobSuggestions(location, majorityJobs, minorityGender, jobContentsMap) {
    const modal = document.getElementById('myModal');
    const modalBody = document.getElementById('modal_body');
    const closeModal = document.getElementsByClassName('close')[0];
    const ul = document.createElement('ul');

    for (let job of majorityJobs) {
        const li = document.createElement('li');
        const jobLink = document.createElement('a');
        jobLink.href = '#';
        jobLink.textContent = job;
        jobLink.style.textDecoration = "none";
        jobLink.style.color = "#CD0010";
        jobLink.style.cursor = "pointer";
        jobLink.addEventListener('click', (event) => {
            loadingSpinner.style.display = 'block'; // Show loading gif
            event.preventDefault();
            // If the results for that role are already in the map, use it
            if (jobContentsMap.has(job)) {
                modalBody.innerHTML = jobContentsMap.get(job);
                loadingSpinner.style.display = 'none'; // Hide loading gif
                modal.style.display = 'block';  // Show the modal
            } else {
                // Otherwise, fetch it
                fetch('/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ location: location, job_title: encodeURIComponent(job), minority_gender: minorityGender })
                }).then((response) => {
                    if (response.ok) {
                        return response.text();
                    } else {
                        throw new Error('Error: ' + response.status + ' ' + response.statusText);
                    }
                }).then((html) => {         
                    jobContentsMap.set(job, html); // Save the fetched HTML in the map for future use
                    modalBody.innerHTML = html;  // Populate modal with the HTML
                    loadingSpinner.style.display = 'none'; // Hide loading gif
                    modal.style.display = 'block';  // Show the modal
                });
            }
        });
        li.appendChild(jobLink);
        ul.appendChild(li);
    }

    jobLinksDiv.appendChild(ul);

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
}

function generateResultsTable(data) {
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
    console.log('display results data: ', response);

    let location = response.location.location;
    console.log('The location is: ', location);

    let data = response.perspectives_data;
    console.log('Perspectives data found: ', data);

    let totalSources = data.length;

    let maleCount = data.filter(person => person.gender === 'Male').length;
    let femaleCount = data.filter(person => person.gender === 'Female').length;
    let unknownCount = data.filter(person => person.gender !== 'Male' && person.gender !== 'Female').length;

    let malePercentage = ((maleCount / totalSources) * 100).toFixed(2);
    let femalePercentage = ((femaleCount / totalSources) * 100).toFixed(2);
    let unknownPercentage = ((unknownCount / totalSources) * 100).toFixed(2);

    let minorityGender, majorityGender;

    if (unknownCount + maleCount + femaleCount === 0) {
        resultsStatementDiv.innerHTML = "There were no sources detected in the text, or the only sources quoted are the main newsmaker(s) or subject(s) of the story. If you think this is wrong, please click on the 'Reset' button and try again.";
        resultsStatementDiv.style.backgroundColor = "#F4D4D5";
    } else {

        if (unknownCount > 0 && maleCount === 0 && femaleCount === 0)  {
            resultsStatementDiv.innerHTML = "We were not able to confidently determine the gender of any sources quoted.";
            resultsStatementDiv.style.backgroundColor = '#FFCD91';
            jobLinksDiv.innerHTML = `<p>Gender is complex and not limited to "male" or "female". Furthermore, naming conventions vary by culture and individual preference, so it is not always possible to accurately determine the gender of a person by their name alone.</p><p>Nonetheless, research shows that on average, men are quoted about three times more than women in UK news articles, reflecting an underrepresentation of women's voices in public discourse. It is always good to try to get a good balance of voices in your story.</p>`;
        } else {
            if (malePercentage > femalePercentage) {
                minorityGender = 'Female';
                majorityGender = 'Male';
                resultsStatementDiv.textContent = `There are more men than women quoted in your story.`;
                resultsStatementDiv.style.backgroundColor = '#FFCD91'; 
            } else if (malePercentage === femalePercentage) {
                resultsStatementDiv.textContent = "There is a perfect balance of men and women quoted in your story. Great job!";
                resultsStatementDiv.style.backgroundColor = "#A4D1A2";
            } else {
                minorityGender = 'Male';
                majorityGender = 'Female';
                resultsStatementDiv.textContent = `There are more women than men quoted in your story.`;
                resultsStatementDiv.style.backgroundColor = '#FFCD91';
            }
        }

        if (majorityGender != null) {
                
            const majorityJobs = [];

            for (let person of data) {
                if (person.gender === majorityGender && person.linkedin === 'yes') {
                    majorityJobs.push(person.role);
                }
            }
            if (majorityJobs.length != 0) {

                if (majorityGender === 'Male') {
                    jobLinksDiv.innerHTML = `<p>There ${maleCount === 1 ? 'was' : 'were'} <b>${maleCount} ${maleCount === 1 ? 'man' : 'men'}</b> and <b>${femaleCount} ${femaleCount === 1 ? 'woman' : 'women'}</b> quoted as additional sources in your story. Research shows that on average, men are quoted about three times more than women in UK news articles, reflecting an underrepresentation of women's voices in public discourse.</p>`
                } else if (majorityGender === 'Female') {
                    jobLinksDiv.innerHTML = `<p>There ${femaleCount === 1 ? 'was' : 'were'} <b>${femaleCount} ${maleCount === 1 ? 'woman' : 'women'}</b> and <b>${maleCount} ${maleCount === 1 ? 'man' : 'men'}</b> quoted as additional sources in your story. Prior research shows that women tend to be quoted more on topics such as lifestyle, entertainment, and healthcare, while men tend to feature more in articles about sports, politics, and business. To avoid reinforcing gendered stereotypes, it is desirable to try to get a good balance of voices.</p>`
                }
                jobLinksDiv.innerHTML += `<p>You might want to consider looking for more ${minorityGender.toLowerCase()} sources. This story appears to be about or set in ${location}. Click on each link to look for LinkedIn profiles of UK-based ${minorityGender.toLowerCase()} sources associated with this location that might fit the following professional roles:</p>`;                
            } else {
                jobLinksDiv.innerHTML = `<p>The sources quoted in this text may play a personal role in the story and therefore be hard to replace with other sources. Nonetheless, you might want to consider including more ${minorityGender.toLowerCase()} perspectives.</p>`
            }

            const jobContentsMap = new Map(); // object to store results each time link clicked so it doesn't have to re-run if clicked again
            jobSuggestions(location, majorityJobs, minorityGender, jobContentsMap);
        }

        let genderData = [
            {category: 'Men', count: maleCount, percentage: malePercentage},
            {category: 'Women', count: femaleCount, percentage: femalePercentage},
            {category: 'Others/unknown', count: unknownCount, percentage: unknownPercentage}
        ];
    
        drawChart(genderData);
    
        generateResultsTable(data);

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
        .then(processResponse)
        .then(displayResults)
        .catch(error => {
            console.error('Error:', error);
            
            // Hide the loading spinner and enable the analyse button in case of an error
            loadingSpinner.style.display = 'none';
            analyseButton.disabled = false;

            // Display the error message in resultsStatementDiv
            resultsStatementDiv.innerHTML = `<p>Oops, something went wrong! Please make sure you have entered text that includes some quotes and try again.</p>`;
            resultsStatementDiv.style.display = 'block'; // ensure the div is visible
            resultsStatementDiv.style.backgroundColor = '#F4D4D5'; // Change the color to indicate an error
        });
}

// Add the event listener to the "Analyse" button
document.getElementById('analyse-button').addEventListener('click', function() {
    analyseArticle();
});