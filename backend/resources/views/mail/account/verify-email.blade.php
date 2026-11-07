<x-mail::message>
# Verifica il tuo indirizzo email

Ciao {{ $firstName }},

usa questo codice per completare la registrazione a Centiva:

<div style="margin: 24px 0; text-align: center; font-size: 32px; font-weight: 700; letter-spacing: 10px; color: #10b981;">{{ $code }}</div>

Il codice scade tra **{{ $expiresInMinutes }} minuti** e può essere utilizzato una sola volta.

Se non hai richiesto tu la registrazione, puoi ignorare questa email. Non comunicare il codice a nessuno.

A presto,<br>
**Il team Centiva**
</x-mail::message>
