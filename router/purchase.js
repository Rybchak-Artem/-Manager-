import express from "express";
import db from "../db/connector.js";
import Groq from "groq-sdk";

const router = express.Router();
const client = new Groq();

router.get('/', (req, res) => {
    res.render('main');
});

router.get('/db', async (req, res) => {
    const result = await db.query('SELECT * FROM purchases ORDER BY created_at DESC');
    res.render('db', { purchases: result.rows });
});

router.get('/add', (req, res) => {
    res.render('add_form', { error: null });
});

router.post('/add', async (req, res) => {
    const { text } = req.body;

    if (!text || text.trim() === '') {
        return res.render('add_form', { error: 'Будь ласка, введіть текст перед відправкою.' });
    }

    try {
        const message = await client.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            max_tokens: 300,
            messages: [
                {
                    role: "system",
                    content: `Ти — парсер тексту. Поверни ТІЛЬКИ валідний JSON без пояснень і markdown.

Правила для "name":
- Витягни ТІЛЬКИ назву компанії або товару (наприклад: "Mercedes", "Apple", "Microsoft")
- НЕ включай слова: "акція", "акції", "штук", "штуки", "купив", "продав"
- Якщо назви компанії/товару немає — поверни null
- Перша літера завжди велика

{
  "name": назва товару з тексту або null якщо немає,
  "quantity": ціле число або null якщо немає,
  "price": число або null якщо не вказана,
  "wallet": назва кошелька на якому лежать ці акції
}`
                },
                { role: "user", content: text }
            ]
        });

        const raw = message.choices[0].message.content;
        const parsed = JSON.parse(raw.replace(/```json|```/gi, '').trim());
        console.log('parsed:', parsed);

        if (!parsed.name || parsed.name === 'null') {
            return res.render('add_form', { error: 'Не вдалося визначити назву товару. Уточніть текст.' });
        }

        if (!parsed.quantity || parsed.quantity === 'null') {
            return res.render('add_form', { error: 'Не вдалося визначити кількість. Уточніть текст.' });
        }

        if (!parsed.price && parsed.price !== 0) {
            return res.render('add_form', { error: 'Не вказана ціна товару. Додайте ціну до тексту.' });
        }

        if (!parsed.wallet || parsed.wallet === 'null') {
            return res.render('add_form', { error: 'Не вдалося визначити кошельок на якому лежать акції. Уточніть текст.' });
        }

        await db.query(
            'INSERT INTO purchases (name, quantity, price, wallet) VALUES ($1, $2, $3, $4)',
            [parsed.name, parsed.quantity ?? 1, parsed.price, parsed.wallet]
        );

        return res.redirect('/db');

    } catch (err) {
        console.error('Помилка:', err);
        return res.render('add_form', { error: 'Не вдалося обробити текст. Спробуйте ще раз.' });
    }
});

router.get('/delete/:id', async (req, res) => {
const { id } = req.params;

try {
    await db.query('DELETE FROM purchases WHERE id = $1', [id]);
    return res.redirect('/db');
} catch (err) {
    console.error('Помилка при видаленні:', err);
    return res.redirect('/db');
}
});

router.get('/update/:id', async (req, res) => {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM purchases WHERE id = $1', [id]);
    res.render('add_form', { purchase: result.rows[0] });
});

router.post('/update/:id', async (req, res) => {
    const { id } = req.params;
    const { name, quantity, price, wallet } = req.body;
    await db.query(
        'UPDATE purchases SET name=$1, quantity=$2, price=$3, wallet=$4 WHERE id=$5',
        [name, quantity, price, wallet, id]
    );
    res.redirect('/db');
});

export default router;
