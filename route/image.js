// Import packages
import ee from '@google/earthengine';
import { simplify } from '@turf/turf';

// Export main function
export default function image(parameter, res){
	let { date, satellite, geojson, visualization } = parameter;

	// Error margin
	const bigMargin = ee.ErrorMargin(1e4, 'meters');

	// Bounds
	const bounds = ee.Feature(geojson).geometry(bigMargin);

	// Date
	const startDate = ee.Date(date[0]);
	const endDate = ee.Date(date[1]);
	const dates = [startDate, endDate];

	// Image composite dictionary
	const imageDict = {
		'landsat': landsat,
		'sentinel2': sentinel2
	};

	// Image composite
	const composite = imageDict[satellite];
	const image = composite(dates, bounds, visualization.bands).median().clip(bounds);

	// Stretch image
	const visualized = stretch(image, visualization.bands);

	// Send data to client
	visualized.getMap({ min: 0, max: 1, ...visualization }, (obj, err) => {
		if (err) {
			res.send({ error: err }).status(404);
		} else {
			res.send({ tile: obj.urlFormat }).status(200);
		};
	});
};

// Function to filter image
function filterImage(col, date, bounds){
	return col.filterBounds(bounds).filterDate(date[0], date[1]);
}

// Satellite image
function landsat(date, bounds, bands){
	// Landsat image collection
	const l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2');
	const l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2');
	
	// Band names
	const bandNames = bands.map(band => `SR_${band}`);
	bandNames.push('QA_PIXEL');
	const cloudBands = Array.from(bands)
	cloudBands.push('QA_PIXEL');

	// Image collection
	const col = filterImage(l8, date, bounds).merge(filterImage(l9, date, bounds))
		.select(bandNames, cloudBands);

	// Return col
	return col.map(landsatCloudMask);
}

// Landsat cloud masking
function landsatCloudMask(image){
	const qa = image.select('QA_PIXEL');
	const dilated = 1 << 1;
	const cirrus = 1 << 2;
	const cloud = 1 << 3;
	const shadow = 1 << 4;
	const mask = qa.bitwiseAnd(dilated).eq(0)
		.and(qa.bitwiseAnd(cirrus).eq(0))
		.and(qa.bitwiseAnd(cloud).eq(0))
		.and(qa.bitwiseAnd(shadow).eq(0));
	return image.select(['B.*'])
		.updateMask(mask)
		.multiply(0.0000275)
		.add(-0.2);
}

// Sentinel 2
function sentinel2(date, bounds, bands){
	const s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED');
	const cloudBands = Array.from(bands)
	cloudBands.push('SCL');
	const col = filterImage(s2, date, bounds).select(cloudBands);
	return col.map(s2Cloudmask);
}

// Sentinel 2 cloud masking
function s2Cloudmask(image){
	const scl = image.select('SCL');
	const mask = scl.eq(3).or(scl.gte(8).and(scl.lte(10))).eq(0);
	return image.select(['B.*']).updateMask(mask).divide(1e4);
}

// Function to stretch image
function stretch(image, bands, min=2, max=98, geometry=image.geometry()){
	const minMax = image.reduceRegion({
		scale: 30,
		maxPixels: 1e13,
		reducer: ee.Reducer.percentile([min, max]),
		geometry
	});
	const scaled = ee.Image(bands.map(band => {
		const imageBand = image.select(band);
		const minValue = ee.Number(minMax.get(`${band}_p${min}`));
		const maxValue = ee.Number(minMax.get(`${band}_p${max}`));
		return imageBand.clamp(minValue, maxValue).unitScale(minValue, maxValue);
	}));
	return scaled;
}