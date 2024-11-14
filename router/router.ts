// Simple router

export interface Routes{ [key: string]: { rest: 'get' | 'post', handler: (req: Request) => Promise<Response> | Response } }

export class Router {
    private routes: { [key: string]: (req: Request) => Promise<Response> | Response } = {};

    // attempt to match the path with a route
    get(path: string, req: Request): void {
        if(this.routes[path + 'get']) {
            this.routes[path + 'get'](req);
        } else {
            // if no route is found, return 404
            throw new Error('Route not found');
        }
    }

    post(path: string, req: Request): void {
        if(this.routes[path + 'post']) {
            this.routes[path + 'post'](req);
        } else {
            throw new Error('Route not found');
        }
    }

    registerRoute(key: string, rest: 'get' | 'post', handler: (req: Request) => Promise<Response> | Response): void {
        this.routes[key + rest] = handler;
    }

    registerRoutes(routes: { [key: string]: { rest: 'get' | 'post', handler: (req: Request) => Promise<Response> | Response } }): void {
        for (const key in routes) {
            const route = routes[key];
            this.routes[key + route.rest] = route.handler;
        }
    }
}

export const routes: Routes = {
    '/balls': { rest: 'get', handler: (req: Request) => {
        const ua = req.headers.get('user-agent')
        return new Response("balls"+ua);
    } },
}