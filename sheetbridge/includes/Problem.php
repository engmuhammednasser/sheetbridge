<?php
namespace SheetBridge;

final class Problem extends \RuntimeException
{
    public function __construct(public readonly string $reason, string $message, public readonly int $status = 400)
    {
        parent::__construct($message);
    }
}

