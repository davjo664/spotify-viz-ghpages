// const rootURL = 'http://127.0.0.1:5000'; // Devolopment
const rootURL = 'https://spotify-wiz.herokuapp.com'; // Production
var auth = {};
var firstDate = new Date('2016-12-29');
var lastDate;
var selectedDate;
var chart = document.getElementById('chart');
var chartTitle = document.getElementById('chart-title');
var timelineText = document.getElementById('timeline-text');
var playButton = document.getElementById('play-button');
var selectedSong = null;
var chartIsVisible = false;
var numberOfSongs = 100;

window.onload = function(){
  var d = new Date();
  var currentDay = d.getDay(); // Sunday = 0, ..., Saturday = 6
  if(currentDay == 6){
    d.setDate(d.getDate() - 2);
  }
  else{
    d.setDate(d.getDate() - (currentDay + 3));
  }
  lastDate = new Date(d);
  selectedDate = new Date(lastDate);
  getAccessToken();
  setupTimeline();
  setGlobalChart(selectedDate);
}

function getAccessToken(){
  var url = rootURL + '/get-access-token';

  fetch(url, {
    mode: 'cors',
    headers: {
      'Access-Control-Allow-Origin':'*'
    }
  })
   .then(function(response){
     return response.json();
   })
   .then(function(obj){
     // Save the token.
     auth = obj;
     // Should be on the form {"access_token":..., "token_type":..., "expires_in":..., "scope":...}
     // "expires_in" will be a number of seconds.
   })
   .then(function(){
     // Update token when it expires
     setTimeout(function(){ getAccessToken(); }, auth.expires_in*1000); // Convert to milliseconds
   })
   .catch(function(err){
     console.error(err);
   });
}

function setGlobalChart(date){
  setChartTitle('Global');
  clearChart();
  if(songSelected()){
    deselectCurrentSong();
  }

  var endDate = new Date(date);
  // For some reason Spotify's URL for weekly charts is +1 day of the selected date
  endDate.setDate(endDate.getDate() + 1);

  var startDate = new Date(endDate);
  // Subtract 1 week
  startDate.setDate(startDate.getDate() - 7);

  var options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "startDate": startDate.YYYYMMDD(),
      "endDate": endDate.YYYYMMDD()
    })
  };

  fetch(rootURL + '/get-global-chart', options)
    .then(function(response){
      return response.json();
    })
    .then(function(obj){
      if(Array.isArray(obj) && obj.length == 202){
        if(!countrySelected()){
          setChart(obj);
        }
      }
      else{
        console.log('No Spotify global chart found on date: ' + date.YYYYMMDD());
        alertNoDataFound();
      }
    })
    .catch(function(err){
      console.error(err);
    });
}

function setCountryChart(countryName, date){
  setChartTitle(countryName);
  clearChart();
  if(songSelected()){
    deselectCurrentSong();
  }

  var isoCode = isoCountries[countryName];
  if(isoCode){
    var endDate = new Date(date);
    // For some reason Spotify's URL for weekly charts is +1 day of the selected date
    endDate.setDate(endDate.getDate() + 1);

    var startDate = new Date(endDate);
    // Subtract 1 week
    startDate.setDate(startDate.getDate() - 7);

    var options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "isoCode": isoCode.toLowerCase(),
        "startDate": startDate.YYYYMMDD(),
        "endDate": endDate.YYYYMMDD()
      })
    };

    fetch(rootURL + '/get-country-chart', options)
      .then(function(response){
        return response.json();
      })
      .then(function(obj){
        if(Array.isArray(obj) && obj.length == 202){
          if(countrySelected()){
            setChart(obj);
          }
        }
        else{
          console.log('No Spotify data found for ' + countryName + ' on date: ' + date.YYYYMMDD());
          alertNoDataFound();
        }
      })
      .catch(function(err){
        console.error(err);
      });
  }
  else{
    console.log('isocode for ' + countryName + ' was not found.');
    alertNoDataFound();
  }
}

function getAudioFeaturesTop100(idArray) {
  var options = {
    method: "GET",
    headers: {
      "Authorization": auth.token_type + " " + auth.access_token
    }
  };

  var idString = "";
  for(var i = 0; i < idArray.length; i++) {
    if (i != 0) {
      idString += ","
    }
    idString += idArray[i]
  }

  fetch('https://api.spotify.com/v1/audio-features/?ids=' + idString, options)
    .then(function(response){
      //console.log(response);
      return response.json();
    })
    .then(function(obj){
      //console.log(JSON.stringify(obj));
      //console.log(obj);
      showParallelCoords(obj.audio_features);
      showChart();

    });
}

Date.prototype.YYYYMMDD = function(){
  var mm = this.getMonth() + 1;
  var dd = this.getDate();
  return [this.getFullYear(), (mm > 9 ? '' : '0') + mm, (dd > 9 ? '' : '0') + dd].join('-');
};

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function clearChart(){
  while(chart.firstChild){
    chart.removeChild(chart.firstChild);
  }
}

function onSongClick(){
  //console.log('onSongClick!');
  //console.log('url: ' + this['data-url']);
  //console.log('spotifyID: ' + this['data-spotifyID']);
  if(songSelected()){
    if(selectedSong == this){
      deselectCurrentSong();
    }
    else{
      deselectCurrentSong();
      selectSong(this);
    }
  }
  else{
    selectSong(this);
  }
}

function selectSong(song){
  selectedSong = song;
  setPlayButtonSource('https://open.spotify.com/embed/track/' + song['data-spotifyID']);
  //showPlayButton();
  song.style.border = '1px solid rgba(255,255,255,0.7)';
  song.style['box-shadow'] = 'inset 0 0 3px #ffffff';
  song.style.background = 'rgba(40,40,40,0.8)';
  song.style['z-index'] = 2;

  for(var i = 0; i < prevFeaturesArray.length; i++){
    if(prevFeaturesArray[i].uri && song['data-spotifyID'] == last22Characters(prevFeaturesArray[i].uri)){
      prevFeaturesArray[i].selected = true;
    }
    else{
      prevFeaturesArray[i].selected = false;
    }
  }
  showParallelCoords();
}

function deselectCurrentSong(){
  if(selectedSong){
    selectedSong.style.border = '1px solid rgb(56, 56, 56)';
    selectedSong.style['box-shadow'] = 'none';
    selectedSong.style.background = 'rgba(0,0,0,0.8)';
    selectedSong.style['z-index'] = 1;
    selectedSong = null;
    for(var i = 0; i < prevFeaturesArray.length; i++){
      prevFeaturesArray[i].selected = false;
    }
    showParallelCoords();
  }
  setPlayButtonSource("");
  //hidePlayButton();
}

function songSelected(){
  return (selectedSong !== null);
}

function last22Characters(str){
  return str.slice(-22);
}

function setChart(data){
  clearChart();
  var spotifyIDArray = [];
  for(var i = 2; i < numberOfSongs + 2; i++){
    var row = data[i];

    var place = row[0];
    var songName = row[1];
    var artist = row[2];
    var streams = row[3];
    var url = row[4];

    var a = document.createElement('a');
    var placeMod = place + '. ';
    a.innerHTML = placeMod.fontcolor("green").bold() + artist + ' - ' + songName;
    a.className = "list-group-item list-group-item-action";
    a['data-url'] = url;
    a['data-spotifyID'] = last22Characters(url);
    a.addEventListener("click", onSongClick, false);

    var span = document.createElement('span');
    span.className = 'badge badge-secondary badge-pill';
    span.innerHTML = numberWithCommas(streams);
    span.style.float = 'right';
    a.appendChild(span);
    chart.appendChild(a);

    if(spotifyIDArray.length < 100) {
      spotifyIDArray.push(a['data-spotifyID']);
    }
  }
  getAudioFeaturesTop100(spotifyIDArray);
}

function setChartTitle(str){
  chartTitle.innerHTML = "Weekly Top " + numberOfSongs + " - " + str;
  chartTitle['data-value'] = str;
}

function alertNoDataFound(){
  clearChart();
  showParallelCoords([]);
  var div = document.createElement('div');
  div.className = 'no-data-found';
  div.innerHTML = 'No data found.';
  chart.appendChild(div);
}

window.onclick = function(event) {
  var graphContainer = document.getElementById("graph-container");
  var graphheader = document.getElementById("graph-header");
  var graphTitle = document.getElementById('graph-title');
  //console.log(event.target.tagName)
  if(event.target === graphheader || event.target === graphTitle){
    if (parallelCoordsVisible) {
      hideParallelCoords();
    } else if (!parallelCoordsVisible) {
      showParallelCoords();
      graphContainer.style.height = window.innerHeight*0.3+40+80 + "px";
      parallelCoordsVisible = true;
    }
  }

  var chartHeader = document.getElementById("chart-header");
  var chartTitle = document.getElementById('chart-title');
  var streamsText = document.getElementById('streams-text');
  //console.log(event.target.tagName)
  if(event.target === chartHeader || event.target === chartTitle || event.target === streamsText){
    if (chartIsVisible) {
      hideChart();
    } else if (!chartIsVisible) {
      showChart();
    }
  }
}

// Based on parallel coordiantes example by Jason Davis, from: https://bl.ocks.org/jasondavies/1341281
var parallelCoordsVisible = false;
function createParallelCoords(featuresArray) {
  var finalArray = featuresArray;
  var selectedIndex = null;
  if(featuresArray.length > 0){
    // Calculate the average values
    var danceability = 0;
    var energy = 0;
    var loudness = 0;
    var speechiness = 0;
    var acousticness = 0;
    var instrumentalness = 0;
    var liveness = 0;
    var valence = 0;
    var tempo = 0;
    var duration_ms = 0;
    var length_min = 0;

    for(var i = 0; i < featuresArray.length; i++){
      danceability += featuresArray[i].danceability;
      energy += featuresArray[i].energy;
      loudness += featuresArray[i].loudness;
      speechiness += featuresArray[i].speechiness;
      acousticness += featuresArray[i].acousticness;
      instrumentalness += featuresArray[i].instrumentalness;
      liveness += featuresArray[i].liveness;
      valence += featuresArray[i].valence;
      tempo += featuresArray[i].tempo;
      duration_ms += featuresArray[i].duration_ms;

      finalArray[i].length_min = featuresArray[i].duration_ms/60000;
      length_min += finalArray[i].length_min;

      if(featuresArray[i].selected){
        finalArray[i].color = "#ffffff";
        finalArray[i].stroke_width = 2;
        selectedIndex = i;
      }
      else{
        finalArray[i].color = "#1db954";
        finalArray[i].stroke_width = 1.5;
      }

      finalArray[i].stroke_dash = "0,0";
    }
    // Move selected song to the end of the array to make sure it's drawn infront of the others
    if(selectedIndex !== null){
      finalArray.push(finalArray.splice(selectedIndex, 1)[0]);
    }

    danceability = danceability/featuresArray.length;
    energy = energy/featuresArray.length;
    loudness = loudness/featuresArray.length;
    speechiness = speechiness/featuresArray.length;
    acousticness = acousticness/featuresArray.length;
    instrumentalness = instrumentalness/featuresArray.length;
    liveness = liveness/featuresArray.length;
    valence = valence/featuresArray.length;
    tempo = tempo/featuresArray.length;
    duration_ms = duration_ms/featuresArray.length;
    length_min = length_min/featuresArray.length;

    var avgSong = {danceability: danceability,
                  energy: energy,
                  loudness: loudness,
                  speechiness: speechiness,
                  acousticness: acousticness,
                  instrumentalness: instrumentalness,
                  liveness: liveness,
                  valence: valence,
                  tempo: tempo,
                  duration_ms: duration_ms,
                  length_min: length_min,
                  color: "#ff0000",
                  stroke_width: 2,
                  stroke_dash: "6,3",
                  selected: false};

    finalArray.push(avgSong);
  }

  var margin = {top: 30, right: 10, bottom: 10, left: 10},
    width = window.innerWidth*0.6,
    height = window.innerHeight*0.3;

  var x = d3.scale.ordinal().rangePoints([0, width], 1),
      y = {},
      dragging = {};

  var line = d3.svg.line(),
      axis = d3.svg.axis().orient("left"),
      background,
      foreground;

  var svg = d3.select("#graph-container").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
  var dimensions = ["name","economy","cylinders","displacement","power","weight","mph","year"];
    // Extract the list of dimensions and create a scale for each.
    x.domain(dimensions = d3.keys(finalArray[0]).filter(function(d) {
      return (d != "name" && d!= "analysis_url" && d!= "id" && d!= "track_href" && d!= "type" && d!= "uri" && d!= "key" && d!= "time_signature" && d!= "mode" && d!="color" && d!="stroke_width" && d!="duration_ms" && d!="selected" && d!="stroke_dash")
      && (y[d] = d3.scale.linear()
          .domain(d3.extent(finalArray, function(p) { return +p[d]; }))
          .range([height, 0]));
    }));

    // Add grey background lines for context.
    background = svg.append("g")
        .attr("class", "background")
      .selectAll("path")
        .data(finalArray)
      .enter().append("path")
        .attr("d", path);

    // Add blue foreground lines for focus.
    foreground = svg.append("g")
        .attr("class", "foreground")
      .selectAll("path")
        .data(finalArray)
      .enter().append("path")
        .attr("d", path)
        .attr("stroke",function(d){
          return d.color;
        })
        .attr("stroke-width", function(d){
          return d.stroke_width;
        })
        .style("stroke-dasharray", function(d){
          return d.stroke_dash;
        });

    // Add a group element for each dimension.
    var g = svg.selectAll(".dimension")
        .data(dimensions)
      .enter().append("g")
        .attr("class", "dimension")
        .attr("transform", function(d) { return "translate(" + x(d) + ")"; })
        .call(d3.behavior.drag()
          .origin(function(d) { return {x: x(d)}; })
          .on("dragstart", function(d) {
            dragging[d] = x(d);
            background.attr("visibility", "hidden");
          })
          .on("drag", function(d) {
            dragging[d] = Math.min(width, Math.max(0, d3.event.x));
            foreground.attr("d", path);
            dimensions.sort(function(a, b) { return position(a) - position(b); });
            x.domain(dimensions);
            g.attr("transform", function(d) { return "translate(" + position(d) + ")"; })
          })
          .on("dragend", function(d) {
            delete dragging[d];
            transition(d3.select(this)).attr("transform", "translate(" + x(d) + ")");
            transition(foreground).attr("d", path);
            background
                .attr("d", path)
              .transition()
                .delay(500)
                .duration(0)
                .attr("visibility", null);
          }));

    // Add an axis and title.
    g.append("g")
        .attr("class", "axis")
        .each(function(d) { d3.select(this).call(axis.scale(y[d])); })
      .append("text")
        .style("text-anchor", "middle")
        .attr("y", -9)
        .text(function(d) {
          if(d == "length_min"){
            return "Length (min)";
          }
          else{
            return bigFirstLetter(d);
          }
        });

    // Add and store a brush for each axis.
    g.append("g")
        .attr("class", "brush")
        .each(function(d) {
          d3.select(this).call(y[d].brush = d3.svg.brush().y(y[d]).on("brushstart", brushstart).on("brush", brush));
        })
      .selectAll("rect")
        .attr("x", -8)
        .attr("width", 16);

  function position(d) {
    var v = dragging[d];
    return v == null ? x(d) : v;
  }

  function transition(g) {
    return g.transition().duration(500);
  }

  // Returns the path for a given data point.
  function path(d) {
    return line(dimensions.map(function(p) { return [position(p), y[p](d[p])]; }));
  }

  function brushstart() {
    d3.event.sourceEvent.stopPropagation();
  }

  // Handles a brush event, toggling the display of foreground lines.
  function brush() {
    var actives = dimensions.filter(function(p) { return !y[p].brush.empty(); }),
        extents = actives.map(function(p) { return y[p].brush.extent(); });
    foreground.style("display", function(d) {
      return actives.every(function(p, i) {
        return extents[i][0] <= d[p] && d[p] <= extents[i][1];
      }) ? null : "none";
    });
  }
}

var prevFeaturesArray;
function showParallelCoords(featuresArray) {
  var graphContainer = document.getElementById("graph-container");
  while (graphContainer.children.length > 1) {
    graphContainer.removeChild(graphContainer.lastChild);
  }
  if (featuresArray) {
    prevFeaturesArray = featuresArray;
    createParallelCoords(featuresArray);
  } else {
    createParallelCoords(prevFeaturesArray);
  }
  setTimeout(() => {
    // parallelCoordsVisible = true;
  }, 500);
}

function hideParallelCoords() {
  var graphContainer = document.getElementById("graph-container");
  graphContainer.style.height = 40+"px";
  parallelCoordsVisible = false;
}

function setupTimeline(){
  timelineText.innerHTML = formatDate(selectedDate);
  var numberOfWeeks = daysBetween(firstDate, lastDate)/7;

  $("#timeline").slider({
    min: 0,
    max: numberOfWeeks,
    step: 1,
    value: numberOfWeeks,
    slide: function( event, ui ) {
      var date = new Date(firstDate);
      date.setDate(date.getDate() + ui.value*7);
      timelineText.innerHTML = formatDate(date);
    },
    stop: function( event, ui ) {
      var date = new Date(firstDate);
      date.setDate(date.getDate() + ui.value*7);
      timelineText.innerHTML = formatDate(date);
      changeDate(date);
    }
  });
}

function daysBetween(date1, date2){
  var diff = Math.abs(date2.getTime() - date1.getTime());
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function changeDate(date){
  selectedDate = date;
  // Update chart with the new date
  if(countrySelected()){
    setCountryChart(getSelectedCountry(), selectedDate);
  }
  else{
    setGlobalChart(selectedDate);
  }
  if(songSelected()){
    deselectCurrentSong();
  }
}

function countrySelected(){
  return (chartTitle['data-value'] !== "Global");
}

function getSelectedCountry(){
  return chartTitle['data-value'];
}

function formatDate(date){
  var yyyy = date.getFullYear();
  var dd = date.getDate();
  dd = (dd > 9 ? '' : '0') + dd;
  var month = date.toLocaleString("en-us", { month: "short" });
  return dd + '-' + month + '-' + yyyy;
}

function setPlayButtonSource(src){
  playButton.src = src;
}

function showPlayButton(){
  playButton.style.display = 'block';
}

function hidePlayButton(){
  playButton.style.display = 'none';
}

function hideChart() {
  var chartContainer = document.getElementById("chart-container");
  chartContainer.style.height = 40+80+"px";
  chartIsVisible = false;
}

function showChart() {
  var chartContainer = document.getElementById("chart-container");
  chartContainer.style.height = window.innerHeight*0.3+40+80 + "px";
  chartIsVisible = true;
}

function bigFirstLetter(str){
  return str.charAt(0).toUpperCase() + str.slice(1);
}
