<x-mail::message>
# Benvenuto in Centiva

Ciao {{ $firstName }},

il tuo account è pronto. Da oggi puoi monitorare entrate, uscite e il risultato del mese in modo semplice, senza dover inserire il patrimonio complessivo.

<x-mail::button :url="$centivaUrl" color="success">
Apri Centiva
</x-mail::button>

Per iniziare, importa uno screenshot Postepay, una foto di uno scontrino o un file CSV. Potrai sempre controllare e correggere i dati prima di usarli nelle tue analisi.

Centiva non effettua trasferimenti bancari: ti aiuta a capire come spendi e quanto riesci a mettere da parte ogni mese.

A presto,<br>
**Il team Centiva**
</x-mail::message>
