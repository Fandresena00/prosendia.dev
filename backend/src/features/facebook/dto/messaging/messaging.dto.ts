import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  /** Internal businessProfileId — used to look up the page token. */
  @IsString()
  @IsNotEmpty()
  businessProfileId!: string;

  /** PSID of the recipient (Facebook user). */
  @IsString()
  @IsNotEmpty()
  recipientPsid!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text!: string;
}

export class ReplyToCommentDto {
  /** Internal businessProfileId owning the page. */
  @IsString()
  @IsNotEmpty()
  businessProfileId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  message!: string;
}

export interface SendMessageResponseDto {
  readonly recipientId: string;
  readonly messageId: string;
}

export interface ReplyToCommentResponseDto {
  readonly commentId: string;
}
