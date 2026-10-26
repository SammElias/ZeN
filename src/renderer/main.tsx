import React from 'react';
import { createRoot } from 'react-dom/client';
import {CodexCompanion} from './CodexCompanion';
import './companion-base.css';
import './capsule-single-row.css';
import './companion-clean.css';
createRoot(document.getElementById('root')!).render(<CodexCompanion/>);
