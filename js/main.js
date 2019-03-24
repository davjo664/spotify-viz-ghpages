// The interactive globe is based on the implementation by "sghall"
// https://github.com/sghall/webgl-globes

import { scene, camera, renderer, canvas } from './common/scene';
import { setEvents } from './common/setEvents';
import { convertToXYZ, getEventCenter, geodecoder } from './common/geoHelpers';
import { mapTexture } from './common/mapTexture';
import { getTween, memoize } from './common/utils';
import { feature as topojsonFeature } from 'topojson';

var controls;
var prevRotation;
var geo;
var root;
var selectOverlay;
var hoverOverlay;
var textureCache;
var selectedCountry = null;
var parallelCoordsVisible = false;
var hoverCountry = null;

const searchField = document.querySelector('#search');
const searchResults = document.querySelector('#results');

const typeHandler = function(e) {
  //console.log(e.target.value)
  console.log("typehandler");
  searchResults.innerHTML = '';
  if (e.target.value === "") {
    return;
  }
  for (var key in geo.getStore()) {
      // console.log(ul.getElementsByTagName("a").length);
      if (searchResults.getElementsByTagName("a").length > 3) {
        return;
      }
      if (key.toLowerCase().startsWith(e.target.value.toLowerCase())) {
        // console.log(key);
        var li = document.createElement("a");
        li.className = "list-group-item list-group-item-action";
        // var btn = document.createElement("BUTTON");
        li.addEventListener('click', function() {
          var country = geo.find(this.textContent);
          if(country.id !== selectedCountry){
            selectedCountry = country.id;
            goToCountryCenter(country.id, country.geometry.coordinates);
            resetSearch();
          }
        });
        var t = document.createTextNode(key);
        // btn.appendChild(t);
        li.appendChild(t);
        searchResults.appendChild(li);
      }
  }
}

function resetSearch(){
  searchField.value = "";
  while(searchResults.firstChild){
    searchResults.removeChild(searchResults.firstChild);
  }
}

searchField.addEventListener('input', typeHandler) // register for oninput

d3.json('data/world.json', function (err, data) {

  d3.select("#loading").transition().duration(500)
    .style("opacity", 0).remove();

  var segments = 155; // number of vertices. Higher = better mouse accuracy

  // Setup cache for country textures
  var countries = topojsonFeature(data, data.objects.countries);
  geo = geodecoder(countries.features);

  textureCache = memoize(function (cntryID, color) {
    var country = geo.find(cntryID);
    return mapTexture(country, color);
  });

  let blackMaterial = new THREE.MeshPhongMaterial({color: '#191414', transparent: true});
  let sphere = new THREE.SphereGeometry(200, segments, segments);
  let baseGlobe = new THREE.Mesh(sphere, blackMaterial);
  baseGlobe.rotation.y = Math.PI;
  baseGlobe.addEventListener('click', onGlobeClick);
  baseGlobe.addEventListener('mousemove', onGlobeMousemove);

  let worldTexture = mapTexture(countries, '#CFD8DC');
  let mapMaterial  = new THREE.MeshPhongMaterial({map: worldTexture, transparent: true});
  var baseMap = new THREE.Mesh(new THREE.SphereGeometry(200, segments, segments), mapMaterial);
  baseMap.rotation.y = Math.PI;

  // create a container node and add the two meshes
  root = new THREE.Object3D();
  root.scale.set(2.5, 2.5, 2.5);
  root.add(baseGlobe);
  root.add(baseMap);
  scene.add(root);

  // controls
  controls = new THREE.OrbitControls( camera, renderer.domElement );
  controls.enableKeys = false;
  controls.minDistance = 800;
  controls.maxDistance = 1400;

  function onGlobeClick(event, pos) {
    //console.log("onGlobeClick");
    if (parallelCoordsVisible) {
      return;
    }
    if (controls.getRotated()) {
      //console.log("rotated")
      return;
    }

    var latlng = getEventCenter.call(this, event);
    var country = geo.search(latlng[0], latlng[1]);

    if (country !== null) {
      console.log('country clicked! code: ' + country.code);
      //console.log('country: ' + JSON.stringify(country));
      var countryData = geo.find(country.code);
      //console.log(countryData.geometry.coordinates[0][0]);
      if(countryData.id == selectedCountry){
        //console.log('already selected');
        selectedCountry = null;
        clearSelectOverlay();
        setHoverOverlay(countryData.id);
        setGlobalChart(selectedDate);
      }
      else{
        clearHoverOverlay();
        selectedCountry = countryData.id;
        goToCountryCenter(countryData.id, countryData.geometry.coordinates);
      }
    }
    else{
      return;
      //console.log('no country here');
    }

  }

  function onGlobeMousemove(event) {

    if (parallelCoordsVisible) {
      return;
    }

    // Get pointc, convert to latitude/longitude
    var latlng = getEventCenter.call(this, event);

    // Look for country at that latitude/longitude
    var country = geo.search(latlng[0], latlng[1]);

    if(country == null && hoverCountry){
      d3.select("#hoverText").html("");
      hoverCountry = null;
      clearHoverOverlay();
    }
    else if(country !== null && country.code !== hoverCountry){
      hoverCountry = country.code;
      d3.select("#hoverText").html(country.code);
      // Highlight the hovercountry (if it's not the selected country)
      if(country.code !== selectedCountry){
        setHoverOverlay(country.code);
      }
      else{
        clearHoverOverlay();
      }
    }

  }

  setEvents(camera, [baseGlobe], 'click');
  setEvents(camera, [baseGlobe], 'mousemove', 10);
});

function goto(pos, code) {
  // Update the top200-chart
  setCountryChart(code, selectedDate);

  if (controls.getRotated()) {
    console.log("rotated")
    return;
  }

  var latlng = [pos[1],pos[0]];
  // Get pointc, convert to latitude/longitude

  // Get new camera position
  var temp = new THREE.Mesh();
  temp.position.copy(convertToXYZ(latlng, 900));
  temp.lookAt(root.position);
  temp.rotateY(Math.PI);

   // Overlay the selected country
   var map = textureCache(code, '#1DB954');
   var material = new THREE.MeshPhongMaterial({map: map, transparent: true});
   if (!selectOverlay) {
     selectOverlay = new THREE.Mesh(new THREE.SphereGeometry(200.8, 40, 40), material);
     selectOverlay.rotation.y = Math.PI;
     root.add(selectOverlay);
   } else {
     selectOverlay.material = material;
   }

  for (let key in temp.rotation) {
    if (temp.rotation[key] - camera.rotation[key] > Math.PI) {
      temp.rotation[key] -= Math.PI * 2;
    } else if (camera.rotation[key] - temp.rotation[key] > Math.PI) {
      temp.rotation[key] += Math.PI * 2;
    }
  }

  var tweenPos = getTween.call(camera, 'position', temp.position);
  d3.timer(tweenPos);

  var tweenRot = getTween.call(camera, 'rotation', temp.rotation);
  d3.timer(tweenRot);
}

function animate() {
  requestAnimationFrame(animate);
  // controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true
  renderer.render(scene, camera);
}
animate();

function clearSelectOverlay(){
  root.remove(selectOverlay);
  selectOverlay = null;
}

function clearHoverOverlay(){
  root.remove(hoverOverlay);
  hoverOverlay = null;
}

function setHoverOverlay(countryName){
  hoverCountry = countryName;
  var map = textureCache(countryName, '#9E9E9E');
  var material = new THREE.MeshPhongMaterial({map: map, transparent: true});
  if (!hoverOverlay) {
    hoverOverlay = new THREE.Mesh(new THREE.SphereGeometry(200.8, 40, 40), material);
    hoverOverlay.rotation.y = Math.PI;
    root.add(hoverOverlay);
  } else {
    hoverOverlay.material = material;
  }
}

function averageCoordinate(arrOfCoords){
  var avgCoord = [];
  for(var i = 0; i < 2; i++){
    var num = 0;
    for(var j = 0; j < arrOfCoords.length; j++){
      num += arrOfCoords[j][i];
    }
    avgCoord.push(num/arrOfCoords.length);
  }
  return avgCoord;
}

function goToCountryCenter(countryName, paths){
  var path;
  if(paths.length == 1){
    path = paths[0];
  }
  else{
    path = longestPath(paths);
  }
  goto(averageCoordinate(path), countryName);
}

function longestPath(paths){
  var longest = [];
  for(var i = 0; i < paths.length; i++){
    if(paths[i][0].length > longest.length){
      longest = paths[i][0];
    }
  }
  return longest;
}
