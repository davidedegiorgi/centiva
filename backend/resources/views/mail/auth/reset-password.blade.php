<x-mail::message>
# Reimposta la tua password

Ciao {{ $firstName }},

abbiamo ricevuto una richiesta per creare una nuova password per il tuo account Centiva.

<x-mail::button :url="$resetUrl" color="success">
Crea una nuova password
</x-mail::button>

Il link è personale e scadrà tra **{{ $expiresInMinutes }} minuti**. Per la tua sicurezza, non inoltrarlo a nessuno.

Se non hai richiesto tu il recupero, puoi ignorare questa email: la password attuale resterà invariata.

A presto,<br>
**Il team Centiva**
</x-mail::message>
