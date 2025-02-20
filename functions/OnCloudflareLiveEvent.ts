export const onRequest: PagesFunction<Env> = async (context) => {
    const request = context.request;
    const headers = request.headers;

    if (headers.get("cf-webhook-auth") !== context.env.AdminKey) {
        return new Response(null, {
            headers: {'content-type': 'text/plain'},
            status: 401
        })
    }

    let incReq = await request.json()

    // so we can see what we actually get sent.
    console.log(incReq)

    return new Response();
};
