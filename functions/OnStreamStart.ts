interface Env {
	KV: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  //
  // Get Current Variables from KV Store
  //
	let access_token = await context.env.KV.get('access_token');
  let refresh_token = await context.env.KV.get('refresh_token');
  let access_token_expires = await context.env.KV.get('access_token_exp');
  let refresh_token_expires = await context.env.KV.get('refresh_token_exp');
  const client_id = await context.env.KV.get('client_id');
  const client_secret = await context.env.KV.get('client_secret');

  if (!access_token) {
    return new Response('Access Token Not Found', { status: 400 });
  }

  if (!refresh_token) {
    return new Response('Refresh Token Not Found', { status: 400 });
  }

  if (!access_token_expires) {
    return new Response('Access Token Expires Not Found', { status: 400 });
  }

  if (!refresh_token_expires) {
    return new Response('Refresh Token Expires Not Found', { status: 400 });
  }

  if (!client_id) {
    return new Response('Client ID Not Found', { status: 400 });
  }

  if (!client_secret) {
    return new Response('Client Secret Not Found', { status: 400 });
  }

  let access_token_exp = parseInt(access_token_expires);
  let refresh_token_exp = parseInt(refresh_token_expires);
  let current_time = Math.floor(Date.now() / 1000);

  //
  // Check if Access Token is Expired
  //
  if (current_time > access_token_exp) {
    // Check if Refresh Token is Expired
    if (current_time > refresh_token_exp) {
      return new Response('Refresh Token Expired', { status: 401 });
    }

    // Get New Access Token and Refresh Token pair
    let response = await fetch('https://api.restream.io/oauth/token', {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${client_id}:${client_secret}`)}`
      },
      method: 'POST',
      body: `grant_type=refresh_token&refresh_token=${refresh_token}`
    });

    let data : any = await response.json();
    if (data.error) {
      return new Response(data.error, { status: 401 });
    }

    // Update KV Store with new tokens
    access_token = data.access_token;
    refresh_token = data.refresh_token;

    await context.env.KV.put('access_token', access_token);
    await context.env.KV.put('refresh_token', refresh_token);

    refresh_token_exp = data.refreshTokenExpiresEpoch;
    access_token_exp = data.accessTokenExpiresEpoch;

    await context.env.KV.put('access_token_exp', access_token_exp.toString());
    await context.env.KV.put('refresh_token_exp', refresh_token_exp.toString());
  }

  //
  // Get Channels
  //
  let response = await fetch('https://api.restream.io/v2/user/channel/all', {
    headers: {
      'Authorization': `Bearer ${access_token}`
    }
  });

  let data : any = await response.json();

  if (data.error) {
    return new Response(data.error, { status: 401 });
  }

  //
  // Build Teams Post
  //
  var post = new Object();
  post['@type'] = 'MessageCard';
  post['@context'] = 'http://schema.org/extensions';
  post['themeColor'] = '0076D7';
  post['summary'] = 'New Live Stream URLs';
  post['sections'] = [];
  post['sections'][0] = new Object();
  post['sections'][0]['activityTitle'] = 'Live Stream Started';
  post['sections'][0]['activityImage'] = 'https://bitfocus.io/_next/image?url=%2Fcompanion.png&w=128&q=75';
  post['sections'][0]['facts'] = [];
  post['sections'][0]['markdown'] = true;

  for (var channel of data) {
    if (channel.enabled) {
      post['sections'][0]['facts'].push({ name: 'Display Name', value: channel.displayName });
      post['sections'][0]['facts'].push({ name: 'URL', value: channel.url });
    }
  }

  // Post to Teams
  const teams_url = await context.env.KV.get('teams_url');
  if (!teams_url) {
    return new Response('Teams URL Not Found', { status: 400 });
  }

  response = await fetch(teams_url, {
    headers: {
      'content-type': 'application/json'
    },
    method: 'POST',
    body: JSON.stringify(post)
  });

  return new Response(JSON.stringify(data), { status: 200 });
}