export interface Purchase {
  seller_id: string;
  product_id: string;
  product_name: string;
  permalink: string;
  product_permalink: string;
  email: string;
  price: number;
  currency: string;
  quantity: number;
  order_number: number;
  sale_id: string;
  sale_timestamp: Date;
  purchaser_id: string;
  test: boolean;
  license_key: string;
  is_gift_receiver_purchase: boolean;
  refunded: boolean;
  disputed: boolean;
  dispute_won: boolean;
  id: string;
  created_at: Date;
  variants: string;
  custom_fields: any[];
  chargebacked: boolean;
}

export interface GumroadSuccessResponse {
  success: true;
  uses: number;
  purchase: Purchase;
}

export interface GumroadErrorResponse {
  success: false;
  message: string;
}

export type GumroadResponse = GumroadSuccessResponse | GumroadErrorResponse;
