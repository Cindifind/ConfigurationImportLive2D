// edge-functions/[[default]].js
export async function onRequest(context) {
    const { request } = context;

    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Max-Age": "86400",
            },
        });
    }

    const upstream = await fetch(request);
    const newHeaders = new Headers(upstream.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    newHeaders.set("Access-Control-Allow-Headers", "*");

    return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: newHeaders,
    });
}