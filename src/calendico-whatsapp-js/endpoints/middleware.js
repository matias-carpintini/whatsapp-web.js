const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        res.set('WWW-Authenticate', 'Basic realm="401"');
        res.status(401).send('Autenticación requerida');
        return;
    }

    const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');

    if (username !== 'C@len' || password !== 'd1co') {
        res.set('WWW-Authenticate', 'Basic realm="401"');
        res.status(401).send('Autenticación requerida');
        return;
    }

    next();
}

module.exports = { authMiddleware };