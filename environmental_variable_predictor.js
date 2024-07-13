//Get the geometry of Model Area
var model_area = ee.FeatureCollection('users/rahmianugraha/model_area');
model_area = model_area.geometry();
Map.centerObject(model_area);
Map.addLayer(model_area, {}, 'Model Area');

// Construct start and end dates:
var start = ee.Date('2020-02-01');
var finish = ee.Date('2021-02-01');


////////////////////////////////////////////////////////////////////////////////////////////////////
// Variable 1 & 2: Elevation and Slope

// Load SRTM Digital Elevation Data 30m
var elevation = ee.Image('USGS/SRTMGL1_003')
            .clip(model_area);

// Apply slope algorithm to elevation.
var slope = ee.Terrain.slope(elevation);

Map.addLayer(elevation, {}, 'Elevation');
Map.addLayer(slope, {}, 'Slope');

// Export the image, specifying scale and region
Export.image.toDrive({
  image: elevation,
  description: 'elevation',
  maxPixels: 1e11,
  scale: 30,
  region: model_area,
  folder: 'Environmental Variable'
  });
Export.image.toDrive({
  image: slope,
  description: 'slope',
  maxPixels: 1e11,
  scale: 30,
  region: model_area,
  folder: 'Environmental Variable'
  });
  
  
//////////////////////////////////////////////////////////////////////////////////////////////////////
// Variable 3 & 4: Normalized Difference Vegetation Index (NDVI) & Land Surface Temperature (LST)
// Cloud mask
function maskL8sr(col) {
  // Bits 3 and 5 are cloud shadow and cloud, respectively.
  var cloudShadowBitMask = (1 << 3);
  var cloudsBitMask = (1 << 5);
  // Get the pixel QA band.
  var qa = col.select('pixel_qa');
  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
                .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return col.updateMask(mask);
}

// Vis params
var vizParams = {
  bands: ['B5', 'B6', 'B4'],
  min: 0,
  max: 4000,
  gamma: [1, 0.9, 1.1]
};
var vizParams2 = {
  bands: ['B4', 'B3', 'B2'],
  min: 0,
  max: 3000,
  gamma: 1.4,
};

// Load the collection
var col = ee.ImageCollection('LANDSAT/LC08/C01/T1_SR')
  .filterDate(start,finish)
  .filterBounds(model_area)
  .map(maskL8sr);

// Image reduction
var image = col.median();
//Map.addLayer(image, vizParams2, 'Landsat 8');

// Select thermal band 10 (with brightness temperature), no calculation 
var thermal= image.select('B10').multiply(0.1);
var b10Params = {min: 291.918, max: 302.382, palette: ['blue', 'white', 'green']};
//Map.addLayer(thermal, b10Params, 'Thermal');


// Compute NDVI
var image = col.median().clip(model_area);
print(image);
var ndvi = image.normalizedDifference(['B5', 'B4']);
var ndviParams =  {
  min: 0.0,
  max: 1.0,
  palette: ['FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718', '74A901',
    '66A000', '529400', '3E8601', '207401', '056201', '004C00', '023B01',
    '012E01', '011D01', '011301'],
};
Map.addLayer(ndvi, ndviParams, 'Normalized Difference Vegetation Index');

// Find the min and max of NDVI
var ndvi_min = ee.Number(ndvi.reduceRegion({
  reducer: ee.Reducer.min(),
  geometry: model_area,
  scale: 30,
  maxPixels: 1e9
}).values().get(0));
print(ndvi_min, 'NDVI_min');

var ndvi_max = ee.Number(ndvi.reduceRegion({
  reducer: ee.Reducer.max(),
  geometry: model_area,
  scale: 30,
  maxPixels: 1e9
}).values().get(0));
print(ndvi_max, 'NDVI_max');

// Propotion of Vegetation
var Pv =(ndvi.subtract(ndvi_min).divide(ndvi_max.subtract(ndvi_min))).pow(ee.Number(2)).rename('Propotion of Vegetation');
//Map.addLayer(Pv);

// Emissivity
var a= ee.Number(0.004);
var b= ee.Number(0.986);
var EM= Pv.multiply(a).add(b).rename('EMM');
var imageVisParam3 = {min: 0.9865619146722164, max:0.989699971371314};
//Map.addLayer(EM, imageVisParam3,'Emissivity');


// LST in Celsius Degree bring -273.15
// NB: In Kelvin don't bring -273.15
var LST_input = {'Tb': thermal.select('B10'), 'Ep': EM.select('EMM')}
var LST = thermal.expression('(Tb/(1 + (0.00115* (Tb / 1.438))*log(Ep)))-273.15',LST_input).rename('LST');

Map.addLayer(LST, {min: 20.569706944223423, max:29.328077233404645, palette:
['blue','limegreen','yellow','darkorange', 'red']}, 'Land Surface Temperature');

// Export the image, specifying scale and region
Export.image.toDrive({
  image: ndvi,
  description: 'ndvi',
  maxPixels: 1e11,
  scale: 30,
  region: model_area,
  folder: 'Environmental Variable'
  });
Export.image.toDrive({
  image: LST,
  description: 'LST',
  maxPixels: 1e11,
  scale: 30,
  region: model_area,
  folder: 'Environmental Variable'
  });