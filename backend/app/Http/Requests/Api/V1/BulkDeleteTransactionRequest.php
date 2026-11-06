<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class BulkDeleteTransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['required', 'uuid', 'distinct'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'ids.required' => 'Seleziona almeno una transazione da eliminare.',
            'ids.max' => 'Puoi eliminare al massimo 100 transazioni alla volta.',
            'ids.*.uuid' => "L'identificativo della transazione non è valido.",
            'ids.*.distinct' => 'La stessa transazione non può essere selezionata più volte.',
        ];
    }
}
