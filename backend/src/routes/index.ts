import { Router } from 'express';
import healthRouter     from './health';
import layersRouter     from './layers';
import facilitiesRouter from './facilities';
import authRouter       from './auth';
import feedbackRouter   from './feedback';

const router = Router();

router.use('/health',     healthRouter);
router.use('/layers',     layersRouter);
router.use('/facilities', facilitiesRouter);
router.use('/auth',       authRouter);
router.use('/feedback',   feedbackRouter);

export default router;
