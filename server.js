// server.js (Versione Cloud Corretta)
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 🟢 REGOLA DI SICUREZZA: Legge in automatico la chiave che hai messo su Render!
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let partita = {
    inCorso: false,
    nomePokemon: "",
    sprite: "",
    verso: "",
    puntiAzione: 25
};

// 🟢 LA RIGA MANCANTE: Dice al server di mostrare la grafica di index.html alla pagina principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- AVVIA NUOVA PARTITA ---
app.get('/api/nuova-partita', async (req, res) => {
    try {
        const idCasuale = Math.floor(Math.random() * 1025) + 1;
        const risposta = await axios.get(`https://pokeapi.co/api/v2/pokemon/${idCasuale}`);
        const dati = risposta.data;

        partita = {
            inCorso: true,
            nomePokemon: dati.name.toLowerCase(),
            sprite: dati.sprites.versions['generation-v']['black-white'].animated.front_default || dati.sprites.front_default,
            verso: dati.cries.latest,
            puntiAzione: 25
        };

        console.log(`🎯 [SERVER] Il Pokémon segreto è: ${partita.nomePokemon.toUpperCase()}`);
        res.json({ messaggio: "Nuovo Pokémon pronto nel Pokédex! Fai la tua prima domanda.", puntiAzione: partita.puntiAzione });

    } catch (errore) {
        res.status(500).json({ errore: "Errore di connessione alla PokéAPI" });
    }
});

// --- FAI DOMANDA ALL'IA VERA ---
app.post('/api/fai-domanda', async (req, res) => {
    const { domanda } = req.body;

    if (!partita.inCorso) return res.status(400).json({ errore: "Nessuna partita in corso." });
    
    partita.puntiAzione -= 1;

    if (partita.puntiAzione <= 0) {
        partita.inCorso = false;
        return res.json({ 
            gameOver: true, 
            messaggio: `Hai perso tutti i Punti Azione!`, 
            nome: partita.nomePokemon, 
            sprite: partita.sprite, 
            verso: partita.verso 
        });
    }

    if (!GEMINI_API_KEY) {
        return res.json({
            risposta: "[SISTEMA] Errore: Render non ha letto correttamente la chiave API!",
            puntiRimanenti: partita.puntiAzione
        });
    }

    try {
        const systemPrompt = `Sei l'arbitro incorruttibile del gioco 'PokéBoh'. Il Pokémon segreto estratto è: ${partita.nomePokemon}.
        Il giocatore ti farà una domanda su di lui. Tu devi rispondere seguendo tassativamente queste regole:
        1. Rispondi SOLO E SOLTANTO con una di queste tre opzioni: "Sì.", "No.", "Non lo so.". Non aggiungere mai spiegazioni, dettagli o altra punteggiatura.
        2. Se nella domanda l'utente nomina direttamente un qualsiasi Pokémon (es: "È l'evoluzione di Haunter?"), devi ignorare la risposta e scrivere esattamente: "[SISTEMA] ERRORE: Usa il pulsante Soluzione per tentare di indovinare!".
        3. Usa la tua enorme conoscenza sul mondo Pokémon per rispondere anche a domande strane, anatomiche, di lore o abitudini (es: se usa la coda per mangiare, se ha le ali, se appare nell'anime, ecc.).`;

        const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const payload = {
            contents: [{
                parts: [{ text: `${systemPrompt}\n\nDomanda del giocatore: "${domanda}"` }]
            }]
        };

        const rispostaGemini = await axios.post(urlGemini, payload);
        let rispostaIA = rispostaGemini.data.candidates[0].content.parts[0].text.trim();
        rispostaIA = rispostaIA.replace(/[\n\r]/g, "");

        res.json({
            risposta: rispostaIA,
            puntiRimanenti: partita.puntiAzione
        });

    } catch (errore) {
        res.json({
            risposta: "Non lo so (Errore dell'IA).",
            puntiRimanenti: partita.putiAzione
        });
    }
});

// --- TENTA LA SOLUZIONE ---
app.post('/api/tenta-soluzione', (req, res) => {
    if (!partita.inCorso) return res.status(400).json({ errore: "Nessuna partita in corso." });

    const tentativo = req.body.tentativo.toLowerCase().trim();

    if (tentativo === partita.nomePokemon) {
        partita.inCorso = false;
        res.json({ vittoria: true, sprite: partita.sprite, verso: partita.verso });
    } else {
        partita.puntiAzione -= 2;
        
        if (partita.puntiAzione <= 0) {
            partita.inCorso = false;
            res.json({ 
                gameOver: true, 
                messaggio: `Tentativo errato! Punti esauriti.`,
                nome: partita.nomePokemon,
                sprite: partita.sprite, 
                verso: partita.verso 
            });
        } else {
            res.json({ vittoria: false, puntiRimanenti: partita.puntiAzione });
        }
    }
});

// Usa la porta dinamica fornita da Render o la 3000 locale
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server PokéBoh attivo sulla porta ${PORT}`));
