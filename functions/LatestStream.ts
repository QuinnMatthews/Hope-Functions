interface Env {
  KV: KVNamespace;
}

export const onRequest: PagesFunction<Env> = async (context) => {
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
    { param: access_token, message: "Access Token" },
    { param: refresh_token, message: "Refresh Token" },
    { param: access_token_expires, message: "Access Token Expires At" },
    { param: refresh_token_expires, message: "Refresh Token Expires At" },
    { param: client_id, message: "Client ID" },
    { param: client_secret, message: "Client Secret" },
  ];
  
  for (const param of requiredParams) {
    if (!param.param) {
      return new Response(`${param.message} Not Found`, { status: 400 });
    }
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
    access_token = data.access_token;
    refresh_token = data.refresh_token;

    await context.env.KV.put("access_token", access_token);
    await context.env.KV.put("refresh_token", refresh_token);

    refresh_token_exp = data.refreshTokenExpiresEpoch;
    access_token_exp = data.accessTokenExpiresEpoch;

    await context.env.KV.put("access_token_exp", access_token_exp.toString());
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
  // Get Platforms
  //
  response = await fetch("https://api.restream.io/v2/platform/all");
  let platforms: any = await response.json();

  if (platforms.error) {
    return new Response(platforms.error, { status: 401 });
  }

  let platformMap = {};
  for (let platform of platforms) {
    platformMap[platform.id] = platform;
  }

  //
  // Build HTML Table with all the channels and their status
  //

  let html = "<table><tr><th>Platform</th><th>Channel Name</th><th>Status</th><th>URL<th/></tr>";
  for (let channel of data) {
    html += `<tr><td>${platformMap[channel.platformId].name}</td><td>${channel.displayName}</td><td>${channel.active}</td><td>${channel.url}</td></tr>`;
  }
  html += "</table>";

  return new Response(html, {
      headers: {
        "content-type": "text/html",
      },
  });




};