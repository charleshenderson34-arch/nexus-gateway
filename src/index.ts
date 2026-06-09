export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    return new Response("Nexus Sync API Active", {
      status: 200,
      headers: { "content-type": "text/plain" }
    });
  }
};
