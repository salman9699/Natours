


export const displayMap = locations => {

    mapboxgl.accessToken = 'pk.eyJ1Ijoic2FsbWFuMjAxNyIsImEiOiJja2Y4aWlxa2cwNjBqMnJvZjkxcHFmNTIzIn0.86t6RQKC4ttKrt9paAXqYQ';
    var map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/salman2017/ckf8l1fwp0k7e19rww93ss6x7',
        scrollZoom: false
        // center: [-118.113491, 34.111743],
        // zoom: 10,
        // interactive: false
    });

    const bounds = new mapboxgl.LngLatBounds();

    locations.forEach(loc => {
        //Create Marker
        const el = document.createElement('div');
        el.className = 'marker';

        //Add marker
        new mapboxgl.Marker({
            element: el,
            anchor: 'bottom'
        }).setLngLat(loc.coordinates).addTo(map);

        //Add popup
        new mapboxgl.Popup({
            offset: 30
        })
            .setLngLat(loc.coordinates)
            .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`)
            .addTo(map)

        //Extends map bounds to include currwent location
        bounds.extend(loc.coordinates);
    });

    map.fitBounds(bounds, {
        padding: {
            top: 200,
            bottom: 130,
            left: 100,
            right: 100
        }
    });
}