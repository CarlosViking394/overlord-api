import Fastify from 'fastify';

const fastify = Fastify({
    logger: true
});

fastify.get('/', async (request, reply) => {
    return { hello: 'world', agent: 'Overlord' };
});

fastify.get('/health', async (request, reply) => {
    return { status: 'ok' };
});

const start = async () => {
    try {
        const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
        await fastify.listen({ port, host: '0.0.0.0' });
        console.log(`Overlord API listening at http://localhost:${port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
