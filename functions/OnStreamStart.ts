interface PostBody {
  key: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  //
  // Get required variables from KV store
  //
  let access_token          = await context.env.KV.get("access_token");
  let refresh_token         = await context.env.KV.get("refresh_token");
  let access_token_expires  = await context.env.KV.get("access_token_exp");
  let refresh_token_expires = await context.env.KV.get("refresh_token_exp");
  const client_id           = await context.env.KV.get("client_id");
  const client_secret       = await context.env.KV.get("client_secret");

  const requiredParams = [
    { param: access_token         , message: "Access Token"             },
    { param: refresh_token        , message: "Refresh Token"            },
    { param: access_token_expires , message: "Access Token Expires At"  },
    { param: refresh_token_expires, message: "Refresh Token Expires At" },
    { param: client_id            , message: "Client ID"                },
    { param: client_secret        , message: "Client Secret"            },
  ];
  
  for (const param of requiredParams) {
    if (!param.param) {
      return new Response(`${param.message} Not Found`, { status: 400 });
    }
  }

  // Validate Admin Key from query string
  const request = context.request;
  const params = new URL(request.url).searchParams;
  const key = params.get("key");

  if (key !== context.env.AdminKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  
  //
  // Check if Access Token is Expired
  //
  let access_token_exp = parseInt(access_token_expires);
  let current_time = Math.floor(Date.now() / 1000);
  
  if (current_time > access_token_exp) {
    // Check if Refresh Token is Expired

    let refresh_token_exp = parseInt(refresh_token_expires);
    if (current_time > refresh_token_exp) {
      return new Response("Refresh Token Expired", { status: 401 });
    }

    // Get New Access Token and Refresh Token pair
    let response = await fetch("https://api.restream.io/oauth/token", {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${client_id}:${client_secret}`)}`,
      },
      method: "POST",
      body: `grant_type=refresh_token&refresh_token=${refresh_token}`,
    });

    let data: any = await response.json();
    if (data.error) {
      return new Response(data.error, { status: 401 });
    }

    // Update KV Store with new tokens
    access_token      = data.access_token;
    refresh_token     = data.refresh_token;
    refresh_token_exp = data.refreshTokenExpiresEpoch;
    access_token_exp  = data.accessTokenExpiresEpoch;

    await context.env.KV.put("access_token",      access_token);
    await context.env.KV.put("refresh_token",     refresh_token);
    await context.env.KV.put("access_token_exp",  access_token_exp.toString());
    await context.env.KV.put("refresh_token_exp", refresh_token_exp.toString());
  }

  //
  // Get Channels
  //
  let response = await fetch("https://api.restream.io/v2/user/channel/all", {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  let data: any = await response.json();

  if (data.error) {
    return new Response(data.error, { status: 401 });
  }

  //
  // Build Teams Post
  //
  var post = new Object();
  post["@type"] = "MessageCard";
  post["@context"] = "http://schema.org/extensions";
  post["themeColor"] = "0076D7";
  post["summary"] = "New Live Stream URLs";
  post["sections"] = [];
  post["sections"][0] = new Object();
  post["sections"][0]["activityTitle"] = "Live Stream Started";
  post["sections"][0]["activityImage"] =
    "https://cf-assets.www.cloudflare.com/slt3lc6tev37/CHOl0sUhrumCxOXfRotGt/081f81d52274080b2d026fdf163e3009/cloudflare-icon-color_3x.png";
  post["sections"][0]["facts"] = [];
  post["sections"][0]["markdown"] = true;

  for (var channel of data) {
    if (channel.enabled) {
      post["sections"][0]["facts"].push({
        name: "Display Name",
        value: channel.displayName,
      });
      post["sections"][0]["facts"].push({ name: "URL", value: channel.url });
    }
  }

  // Post to Teams
  response = await fetch(context.env.TeamsWebhook, {
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(post),
  });

  data = await response.json();

  console.log(JSON.stringify(data));

  if (data.error) {
    return new Response(data.error, { status: 400 });
  }

  return new Response(JSON.stringify(data), { status: 200 });
};
