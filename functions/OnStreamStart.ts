import { Platform, Channel, ErrorResp, Event } from "./types";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  //
  // Get required variables from KV store
  //
  console.log("Getting required variables from KV store");
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

  console.log("Checking required parameters");
  for (const param of requiredParams) {
    if (!param.param) {
      return new Response(`${param.message} Not Found`, { status: 400 });
    }
  }

  //
  // Validate Admin Key from query string
  // TODO: We should use a more secure method to authenticate
  //
  console.log("Validating Admin Key");
  const request = context.request;
  const params = new URL(request.url).searchParams;
  const key = params.get("key");

  if (key !== context.env.AdminKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  //
  // Check if Access Token is Expired
  //
  console.log("Checking if Access Token is Expired");
  let access_token_exp = parseInt(access_token_expires);
  let current_time = Math.floor(Date.now() / 1000);

  if (current_time > access_token_exp) {
    console.log("Access Token Expired, refreshing token");

    // Check if Refresh Token is Expired
    console.log("Checking if Refresh Token is Expired");
    let refresh_token_exp = parseInt(refresh_token_expires);
    if (current_time > refresh_token_exp) {
      return new Response("Refresh Token Expired", { status: 401 });
    }

    // Get New Access Token and Refresh Token pair
    console.log("Getting new Access Token and Refresh Token pair");
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
    console.log("Updating KV Store with new tokens");
    access_token = data.access_token;
    refresh_token = data.refresh_token;
    refresh_token_exp = data.refreshTokenExpiresEpoch;
    access_token_exp = data.accessTokenExpiresEpoch;

    await context.env.KV.put("access_token", access_token);
    await context.env.KV.put("refresh_token", refresh_token);
    await context.env.KV.put("access_token_exp", access_token_exp.toString());
    await context.env.KV.put("refresh_token_exp", refresh_token_exp.toString());
  }

  //
  // Get Platform Info
  //
  console.log("Getting Platform Info");
  let platformsResp = await fetch("https://api.restream.io/v2/platform/all");
  let platforms = await platformsResp.json<Platform[] | ErrorResp>();

  if ((platforms as ErrorResp).error) {
    return new Response((platforms as ErrorResp).error, {
      status: platformsResp.status,
    });
  } else {
    platforms = platforms as Platform[];
  }

  let platformMap = {};
  for (let platform of platforms) {
    platformMap[platform.id] = platform;
  }

  //
  // Get In-Progress Events
  //
  console.log("Getting In-Progress Events");
  let inprogressEventsResp = await fetch(
    "https://api.restream.io/v2/user/events/in-progress",
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    }
  );

  let inprogressEvents = await inprogressEventsResp.json<Event[] | ErrorResp>();

  if ((inprogressEvents as ErrorResp).error) {
    return new Response((inprogressEvents as ErrorResp).error, {
      status: inprogressEventsResp.status,
    });
  } else {
    inprogressEvents = inprogressEvents as Event[];
  }

  //
  // Get Channel Info
  //
  console.log("Getting Channel Info");
  let channelInfoResp = await fetch(
    "https://api.restream.io/v2/user/channel/all",
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    }
  );

  let channelInfo = await channelInfoResp.json<Channel[] | ErrorResp>();

  if ((channelInfo as ErrorResp).error) {
    return new Response((channelInfo as ErrorResp).error, {
      status: channelInfoResp.status,
    });
  } else {
    channelInfo = channelInfo as Channel[];
  }

  let channelMap = {};
  for (let channel of channelInfo) {
    channelMap[channel.id] = channel;
  }

  //
  // Build Teams Post
  //
  console.log("Building Teams Post(s)");
  for (let streamEvent of inprogressEvents) { // TODO: We probably need to handle multiple in-progress events better than this but for now we are likely to only have one
    var post = new Object();
    post["@type"] = "MessageCard";
    post["@context"] = "http://schema.org/extensions";
    post["themeColor"] = "0076D7";
    post["summary"] = "New Live Stream URLs";
    post["sections"] = [];
    post["sections"][0] = new Object();
    post["sections"][0]["activityTitle"] = "Live Stream Started";
    post["sections"][0]["activitySubtitle"] = streamEvent.title;
    post["sections"][0]["activityImage"] =
      "https://cf-assets.www.cloudflare.com/slt3lc6tev37/CHOl0sUhrumCxOXfRotGt/081f81d52274080b2d026fdf163e3009/cloudflare-icon-color_3x.png";
    post["sections"][0]["facts"] = [];
    post["sections"][0]["markdown"] = true;

    console.log(`--Adding destinations for event: ${streamEvent.title}`);
    for (var destination of streamEvent.destinations) {
      var channel = channelMap[destination.channelId];
      var platform = platformMap[destination.streamingPlatformId];
      post["sections"][0]["facts"].push({
        name: `${platform.name} - ${channel.displayName}`,
        value: destination.externalUrl,
      });
    }

    if (streamEvent.destinations.length == 0) {
      console.log("--No destinations found, adding Restream to Teams Post");
      post["sections"][0]["facts"].push({
        name: "Restream",
        value: "No Streams Found (Stream is active in Restream but no channels enabled)", 
      });
    }

    // Post to Teams
    inprogressEventsResp = await fetch(context.env.TeamsWebhook, {
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(post),
    });
  } 

  //
  // Handle Case where no in-progress events are found
  //
  if (inprogressEvents.length == 0) {
    console.log("No in-progress events found, sending alert to Teams");
    post["@type"] = "MessageCard";
    post["@context"] = "http://schema.org/extensions";
    post["themeColor"] = "0076D7";
    post["summary"] = "Live Stream Started but no streams found";
    post["sections"] = [];
    post["sections"][0] = new Object();
    post["sections"][0]["activityTitle"] = "Live Stream Started";
    post["sections"][0]["activitySubtitle"] = "A live stream has started but restream has no active streams, this could indicate an issue with the restream service or our network";
    post["sections"][0]["activityImage"] =
      "https://cf-assets.www.cloudflare.com/slt3lc6tev37/CHOl0sUhrumCxOXfRotGt/081f81d52274080b2d026fdf163e3009/cloudflare-icon-color_3x.png";

    // Post to Teams
    inprogressEventsResp = await fetch(context.env.TeamsWebhook, {
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(post),
    });
  }

  console.log("Returning in-progress events");
  return new Response(JSON.stringify(inprogressEvents), {
    headers: {
      "content-type": "application/json",
    },
    status: 200
  });
};
