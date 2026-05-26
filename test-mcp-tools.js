async function testMcpTools() {
  const baseUrl = 'http://127.0.0.1:18060';
  let sessionId = null;
  let requestId = 1;

  // Step 1: Initialize
  console.log('Step 1: Initializing...');
  const initResponse = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: requestId++,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    })
  });

  sessionId = initResponse.headers.get('mcp-session-id');
  console.log('Session ID:', sessionId);
  const initJson = await initResponse.json();
  console.log('Initialize result:', JSON.stringify(initJson, null, 2));

  // Step 2: Send initialized notification
  console.log('\nStep 2: Sending initialized notification...');
  await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Mcp-Session-Id': sessionId
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {}
    })
  });

  // Step 3: List tools
  console.log('\nStep 3: Listing tools...');
  const toolsResponse = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Mcp-Session-Id': sessionId
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: requestId++,
      method: 'tools/list',
      params: {}
    })
  });

  const toolsJson = await toolsResponse.json();
  console.log('Available tools:', JSON.stringify(toolsJson, null, 2));
}

testMcpTools().catch(console.error);
