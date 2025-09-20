/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your Worker in action
 * - Run `npm run deploy` to publish your Worker
 *
 * Bind resources to your Worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */


export interface Env {
	TODOS: KVNamespace;
	ASSETS: { fetch: (req: Request) => Promise<Response> };
}

function getId() {
	return crypto.randomUUID();
}

async function getTodos(env: Env) {
	const data = await env.TODOS.get('todos', 'json');
	return Array.isArray(data) ? data : [];
}

async function saveTodos(env: Env, todos: any[]) {
	await env.TODOS.put('todos', JSON.stringify(todos));
}

export default {
	async fetch(req: Request, env: Env) {
		const url = new URL(req.url);
		const { pathname } = url;

		// API: /api/todos
		if (pathname === '/api/todos' && req.method === 'GET') {
			const todos = await getTodos(env);
			return Response.json(todos);
		}

		if (pathname === '/api/todos' && req.method === 'POST') {
			const body = await req.json() as any;
			const text = body.text;
			if (!text) return new Response('Missing text', { status: 400 });
			const todos = await getTodos(env);
			const todo = { id: getId(), text, completed: false };
			todos.push(todo);
			await saveTodos(env, todos);
			return Response.json(todo);
		}

		// PUT /api/todos/:id
		const putMatch = pathname.match(/^\/api\/todos\/(.+)$/);
		if (putMatch && req.method === 'PUT') {
			const id = putMatch[1];
			const body = await req.json() as any;
			const text = body.text;
			const completed = body.completed;
			const todos = await getTodos(env);
			const idx = todos.findIndex((t: any) => t.id === id);
			if (idx === -1) return new Response('Not found', { status: 404 });
			if (typeof text === 'string') todos[idx].text = text;
			if (typeof completed === 'boolean') todos[idx].completed = completed;
			await saveTodos(env, todos);
			return Response.json(todos[idx]);
		}

		// DELETE /api/todos/:id
		const delMatch = pathname.match(/^\/api\/todos\/(.+)$/);
		if (delMatch && req.method === 'DELETE') {
			const id = delMatch[1];
			let todos = await getTodos(env);
			todos = todos.filter((t: any) => t.id !== id);
			await saveTodos(env, todos);
			return new Response('Deleted', { status: 200 });
		}

		// DELETE /api/todos/finished
		if (pathname === '/api/todos/finished' && req.method === 'DELETE') {
			let todos = await getTodos(env);
			todos = todos.filter((t: any) => !t.completed);
			await saveTodos(env, todos);
			return new Response('Deleted finished', { status: 200 });
		}

		// Serve static assets
		if (env.ASSETS) {
			// @ts-ignore
			return env.ASSETS.fetch(req);
		}
		return new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
