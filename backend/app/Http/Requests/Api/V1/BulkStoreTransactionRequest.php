<?php

namespace App\Http\Requests\Api\V1;

use App\Enums\TransactionSource;
use App\Enums\TransactionType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BulkStoreTransactionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'transactions' => ['required', 'array', 'min:1', 'max:100'],
            'transactions.*.type' => ['required', Rule::enum(TransactionType::class)],
            'transactions.*.amount' => [
                'required',
                'numeric',
                'decimal:0,2',
                'gt:0',
                'max:999999999999.99',
            ],
            'transactions.*.currency' => [
                'required',
                'string',
                'size:3',
                'regex:/^[A-Z]{3}$/',
            ],
            'transactions.*.occurred_on' => ['required', 'date'],
            'transactions.*.description' => ['required', 'string', 'max:255'],
            'transactions.*.merchant' => ['nullable', 'string', 'max:160'],
            'transactions.*.category' => ['nullable', 'string', 'max:100'],
            'transactions.*.notes' => ['nullable', 'string', 'max:2000'],
            'transactions.*.source' => [
                'required',
                Rule::enum(TransactionSource::class)->only([
                    TransactionSource::Csv,
                    TransactionSource::Ocr,
                ]),
            ],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'transactions.required' => 'Aggiungi almeno una transazione da importare.',
            'transactions.max' => 'Puoi importare al massimo 100 transazioni alla volta.',
            'transactions.*.amount.gt' => 'Ogni importo deve essere maggiore di zero.',
            'transactions.*.description.required' => 'Ogni transazione deve avere una descrizione.',
            'transactions.*.source.enum' => "L'origine dell'importazione non è valida.",
        ];
    }

    protected function prepareForValidation(): void
    {
        $transactions = $this->input('transactions');

        if (! is_array($transactions)) {
            return;
        }

        $this->merge([
            'transactions' => array_map(function (mixed $transaction): mixed {
                if (! is_array($transaction) || ! isset($transaction['currency'])) {
                    return $transaction;
                }

                $transaction['currency'] = Str::upper((string) $transaction['currency']);

                return $transaction;
            }, $transactions),
        ]);
    }
}
