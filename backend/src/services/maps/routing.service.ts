export interface Coordinates{
    latitude: number;
    longitude: number;
}

export interface WalkingRoute{
    distanceMeters: number;
    durationSeconds: number;
    geometry:[number,number][];
}

export async function getWalkingRoute(start: Coordinates, destination: Coordinates): Promise<WalkingRoute>{
    const response=await fetch(
        "https://valhalla1.openstreetmap.de/route",
        {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body: JSON.stringify({
                locations:[
                    {lat: start.latitude, lon:start.longitude},
                    {lat: destination.latitude, lon:destination.longitude},
                ],
                costing:"pedestrian",
                units:"kilometers",
                shape_format:"geojson",
            }),
        }
    );

    if(!response.ok){
        throw new Error(`Routing service failed: ${response.status}`);
    }

    const data=await response.json();
    const leg=data.trip?.legs?.[0];

    if(!leg||!leg.shape?.coordinates){
        throw new Error("No walking route was found!");
    }
    
    return{
        distanceMeters: data.trip.summary.length*1000,
        durationSeconds: data.trip.summary.time,
        geometry: leg.shape.coordinates,
    }
}