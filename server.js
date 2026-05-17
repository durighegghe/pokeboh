// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 🔴 METTI QUI LA TUA CHIAVE API GRATUITA DI GEMINI 🔴
const GEMINI_API_KEY = "AIzaSyCmoMpdDvTWzCH0puTwWc5Eu78fcz7Pv3Y";

let partita = {
    inCorso: false,
    nomePokemon: "",
    sprite: "",
    verso: "",
    puntiAzione: 25
};

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

        console.log(`\n🔮 [SERVER] Nuova partita iniziata!`);
        console.log(`🎯 [SERVER] Il Pokémon segreto è: ${partita.nomePokemon.toUpperCase()}\n`);
        
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

    // Se finisce i punti con questa domanda, è Game Over
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

    if (GEMINI_API_KEY === "COPIA_QUI_LA_TUA_CHIAVE") {
        return res.json({
            risposta: "[SISTEMA] Errore: Non hai inserito la chiave API dentro server.js!",
            puntiRimanenti: partita.puntiAzione
        });
    }

    try {
        // Prepariamo le istruzioni segrete per l'IA
        const systemPrompt = `Sei l'arbitro incorruttibile del gioco 'PokéBoh'. Il Pokémon segreto estratto è: ${partita.nomePokemon}.
        Il giocatore ti farà una domanda su di lui. Tu devi rispondere seguendo tassativamente queste regole:
        1. Rispondi SOLO E SOLTANTO con una di queste tre opzioni: "Sì.", "No.", "Non lo so.". Non aggiungere mai spiegazioni, dettagli o altra punteggiatura.
        2. Se nella domanda l'utente nomina direttamente un qualsiasi Pokémon (es: "È l'evoluzione di Haunter?"), devi ignorare la risposta e scrivere esattamente: "[SISTEMA] ERRORE: Usa il pulsante Soluzione per tentare di indovinare!".
        3. Usa la tua enorme conoscenza sul mondo Pokémon per rispondere anche a domande strane, anatomiche, di lore o abitudini (es: se usa la coda per mangiare, se ha le ali, se appare nell'anime, ecc.).`;

        // Chiamata API ufficiale a Gemini
        const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const payload = {
            contents: [{
                parts: [{ text: `${systemPrompt}\n\nDomanda del giocatore: "${domanda}"` }]
            }]
        };

        const rispostaGemini = await axios.post(urlGemini, payload);
        
        // Estraiamo il testo pulito risposto da Gemini
        let rispostaIA = rispostaGemini.data.candidates[0].content.parts[0].text.trim();

        // Pulizia finale da spazi o a capo molesti
        rispostaIA = rispostaIA.replace(/[\n\r]/g, "");

        res.json({
            risposta: rispostaIA,
            puntiRimanenti: partita.puntiAzione
        });

    } catch (errore) {
        console.error("Errore IA:", errore.message);
        res.json({
            risposta: "Non lo so (Errore di comunicazione con l'IA).",
            puntiRimanenti: partita.puntiAzione
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

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Server PokéBoh con IA attiva su http://localhost:${PORT}`));