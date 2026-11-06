<?php

namespace App\Http\Requests\Api\V1;

use App\Enums\TransactionType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoreTransactionRequest extends FormRequest
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
            'type' => ['required', Rule::enum(TransactionType::class)],
            'amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:999999999999.99'],
            'currency' => ['required', 'string', 'size:3', 'regex:/^[A-Z]{3}$/'],
            'occurred_on' => ['required', 'date'],
            'category' => ['required', 'string', 'max:100'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'type.required' => 'Il tipo di transazione è obbligatorio.',
            'type.enum' => 'Il tipo di transazione non è valido.',
            'amount.required' => "L'importo è obbligatorio.",
            'amount.numeric' => "L'importo deve essere un numero.",
            'amount.decimal' => "L'importo può avere al massimo due decimali.",
            'amount.gt' => "L'importo deve essere maggiore di zero.",
            'currency.regex' => 'La valuta deve essere un codice ISO di tre lettere.',
            'occurred_on.required' => 'La data è obbligatoria.',
            'occurred_on.date' => 'La data non è valida.',
            'category.required' => 'La categoria è obbligatoria.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('currency')) {
            $this->merge([
                'currency' => Str::upper($this->string('currency')->toString()),
            ]);
        }
    }
}
