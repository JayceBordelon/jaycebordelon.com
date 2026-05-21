---
id: "blended-protos"
title: "Request Correlation in a gRPC Microservices Architecture"
summary: "Exploring how to maintain request correlation across async gRPC service calls using blended protobuf patterns, bidirectional streaming, and correlation IDs to build truly non-blocking microservice architectures."
label: "Information"
author: "Jayce Bordelon"
authorDesc: "SWE"
published: "2026-01-08"
image: "/images/blended-protos.gif"
readTime: "8 min read"
tags: ["Microservices"]
---

In modern distributed systems built on gRPC, maintaining request correlation across multiple asynchronous service calls is critical. While gRPC provides excellent primitives for service-to-service communication, aggregating responses from multiple microservices while preserving correlation requires careful architectural design. This article explores a pattern I call "blended protobufs" that elegantly solves this challenge.

## The Correlation Challenge in gRPC Microservices

Consider a typical API gateway in a microservices architecture. A client makes a single request, and your gateway needs to fan out to multiple gRPC services, aggregate their responses, and return a unified result. The naive approach looks like this:

```typescript
async function handleRequest(req: GatewayRequest): Promise<GatewayResponse> {
  const [userData, orderData, inventoryData] = await Promise.all([
    userServiceClient.getUser({ userId: req.userId }),
    orderServiceClient.getOrders({ userId: req.userId }),
    inventoryServiceClient.getInventory({ productIds: req.productIds }),
  ]);

  return aggregateResponse(userData, orderData, inventoryData);
}
```

This works fine for a single request, but when you have thousands of concurrent requests hitting your gateway, each triggering multiple downstream gRPC calls, you need a robust correlation mechanism. Without it, you risk:

1. **Response mismatching**: Associating responses from service A with the wrong originating request
2. **Memory leaks**: Holding onto state for abandoned or timed-out requests
3. **Partial failures**: Not knowing which responses arrived and which didn't
4. **Horizontal scaling issues**: Inability to scale your gateway across multiple instances

## What are Blended Protobufs?

Blended protobufs is an architectural pattern where you define a unified protobuf schema that combines request and response types from multiple services into a single stream-based contract. Instead of calling services individually, you use gRPC's bidirectional streaming to maintain correlation naturally through the stream context.

Here's the core concept:

```protobuf
// blended_aggregation.proto
syntax = "proto3";

service AggregationService {
  rpc StreamAggregation(stream AggregationRequest) returns (stream AggregationResponse);
}

message AggregationRequest {
  string correlation_id = 1;

  oneof request {
    UserRequest user_request = 2;
    OrderRequest order_request = 3;
    InventoryRequest inventory_request = 4;
  }
}

message AggregationResponse {
  string correlation_id = 1;

  oneof response {
    UserResponse user_response = 2;
    OrderResponse order_response = 3;
    InventoryResponse inventory_response = 4;
    ErrorResponse error = 5;
  }
}

// Individual service message types
message UserRequest {
  string user_id = 1;
}

message UserResponse {
  string user_id = 1;
  string name = 2;
  string email = 3;
}

message OrderRequest {
  string user_id = 1;
  int32 limit = 2;
}

message OrderResponse {
  repeated Order orders = 1;
}

message InventoryRequest {
  repeated string product_ids = 1;
}

message InventoryResponse {
  repeated InventoryItem items = 1;
}

message ErrorResponse {
  string service_name = 1;
  string error_message = 2;
  int32 error_code = 3;
}
```

The key insight is using `oneof` to blend multiple service contracts into a single streaming interface. Each request and response carries a correlation ID that flows naturally through the stream.

## Implementation: Gateway Service

Here's how you implement the gateway service that handles client requests and orchestrates downstream calls:

```typescript
import * as grpc from "@grpc/grpc-js";
import { AggregationServiceServer } from "./generated/blended_aggregation_grpc_pb";

class GatewayAggregationService implements AggregationServiceServer {
  private userClient: UserServiceClient;
  private orderClient: OrderServiceClient;
  private inventoryClient: InventoryServiceClient;

  constructor(
    userClient: UserServiceClient,
    orderClient: OrderServiceClient,
    inventoryClient: InventoryServiceClient
  ) {
    this.userClient = userClient;
    this.orderClient = orderClient;
    this.inventoryClient = inventoryClient;
  }

  streamAggregation(
    call: grpc.ServerDuplexStream<AggregationRequest, AggregationResponse>
  ): void {
    call.on("data", async (request: AggregationRequest) => {
      const correlationId = request.getCorrelationId();

      try {
        // Route to appropriate service based on request type
        const requestCase = request.getRequestCase();

        switch (requestCase) {
          case AggregationRequest.RequestCase.USER_REQUEST: {
            const userReq = request.getUserRequest()!;
            const userResp = await this.userClient.getUser(userReq);

            const response = new AggregationResponse();
            response.setCorrelationId(correlationId);
            response.setUserResponse(userResp);
            call.write(response);
            break;
          }

          case AggregationRequest.RequestCase.ORDER_REQUEST: {
            const orderReq = request.getOrderRequest()!;
            const orderResp = await this.orderClient.getOrders(orderReq);

            const response = new AggregationResponse();
            response.setCorrelationId(correlationId);
            response.setOrderResponse(orderResp);
            call.write(response);
            break;
          }

          case AggregationRequest.RequestCase.INVENTORY_REQUEST: {
            const invReq = request.getInventoryRequest()!;
            const invResp = await this.inventoryClient.getInventory(invReq);

            const response = new AggregationResponse();
            response.setCorrelationId(correlationId);
            response.setInventoryResponse(invResp);
            call.write(response);
            break;
          }
        }
      } catch (error) {
        const errorResponse = new AggregationResponse();
        errorResponse.setCorrelationId(correlationId);

        const errorMsg = new ErrorResponse();
        errorMsg.setErrorMessage(error.message);
        errorMsg.setErrorCode(grpc.status.INTERNAL);

        errorResponse.setError(errorMsg);
        call.write(errorResponse);
      }
    });

    call.on("end", () => {
      call.end();
    });

    call.on("error", (error) => {
      console.error("Stream error:", error);
    });
  }
}
```

## Implementation: Client-Side Correlation

The client side uses the bidirectional stream to send multiple requests and collect responses, correlating them by ID:

```typescript
class AggregationClient {
  private client: AggregationServiceClient;

  async aggregateData(
    userId: string,
    productIds: string[]
  ): Promise<AggregatedData> {
    return new Promise((resolve, reject) => {
      const correlationId = crypto.randomUUID();
      const call = this.client.streamAggregation();

      // Track expected responses
      const responses = new Map<string, any>();
      const expectedResponses = new Set(["user", "order", "inventory"]);

      // Set timeout
      const timeout = setTimeout(() => {
        call.end();
        reject(new Error("Aggregation timeout"));
      }, 5000);

      // Handle incoming responses
      call.on("data", (response: AggregationResponse) => {
        if (response.getCorrelationId() !== correlationId) {
          return; // Not our response
        }

        const responseCase = response.getResponseCase();

        switch (responseCase) {
          case AggregationResponse.ResponseCase.USER_RESPONSE:
            responses.set("user", response.getUserResponse());
            expectedResponses.delete("user");
            break;

          case AggregationResponse.ResponseCase.ORDER_RESPONSE:
            responses.set("order", response.getOrderResponse());
            expectedResponses.delete("order");
            break;

          case AggregationResponse.ResponseCase.INVENTORY_RESPONSE:
            responses.set("inventory", response.getInventoryResponse());
            expectedResponses.delete("inventory");
            break;

          case AggregationResponse.ResponseCase.ERROR:
            const error = response.getError();
            console.error(`Service error: ${error!.getErrorMessage()}`);
            break;
        }

        // Check if we have all responses
        if (expectedResponses.size === 0) {
          clearTimeout(timeout);
          call.end();
          resolve(this.mergeResponses(responses));
        }
      });

      call.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      // Send all requests with same correlation ID
      const userRequest = new AggregationRequest();
      userRequest.setCorrelationId(correlationId);
      userRequest.setUserRequest(new UserRequest().setUserId(userId));
      call.write(userRequest);

      const orderRequest = new AggregationRequest();
      orderRequest.setCorrelationId(correlationId);
      orderRequest.setOrderRequest(new OrderRequest().setUserId(userId));
      call.write(orderRequest);

      const inventoryRequest = new AggregationRequest();
      inventoryRequest.setCorrelationId(correlationId);
      inventoryRequest.setInventoryRequest(
        new InventoryRequest().setProductIdsList(productIds)
      );
      call.write(inventoryRequest);
    });
  }

  private mergeResponses(responses: Map<string, any>): AggregatedData {
    return {
      user: responses.get("user"),
      orders: responses.get("order")?.getOrdersList() || [],
      inventory: responses.get("inventory")?.getItemsList() || [],
    };
  }
}
```

## Benefits of Blended Protobufs

This pattern provides several key advantages:

**Natural correlation**: The bidirectional stream maintains correlation context automatically. You don't need external state stores or distributed tracing infrastructure just for correlation.

**Type safety**: Protocol buffers provide strong typing across your entire service mesh. The `oneof` pattern ensures type-safe handling of different message types.

**Efficient multiplexing**: A single stream can handle multiple concurrent aggregations, reducing connection overhead.

**Graceful degradation**: Individual service failures can be isolated and reported through the error response type without breaking the entire aggregation.

**Horizontal scalability**: Because correlation is maintained within the stream, your gateway can scale horizontally without shared state.

**Backpressure handling**: gRPC streams provide built-in backpressure, preventing overwhelming downstream services.

## Advanced Pattern: Parallel Service Chains

You can extend this pattern to handle complex service dependencies:

```protobuf
message AggregationRequest {
  string correlation_id = 1;
  string parent_request_id = 2;  // For chained requests

  oneof request {
    UserRequest user_request = 3;
    OrderRequest order_request = 4;
    InventoryRequest inventory_request = 5;
    PaymentRequest payment_request = 6;  // Depends on order
    ShippingRequest shipping_request = 7;  // Depends on order + inventory
  }
}
```

Your gateway can then orchestrate chains like: User → Orders → (Payment || Shipping), maintaining correlation across the entire dependency graph.

## Best Practices

**Always set timeouts**: Configure reasonable deadlines on your gRPC calls to prevent indefinite hangs.

**Implement circuit breakers**: Wrap downstream service calls with circuit breakers to fail fast when services are unhealthy.

**Use metadata for tracing**: Combine correlation IDs with distributed tracing by propagating trace context in gRPC metadata.

**Monitor stream health**: Track metrics like active streams, average aggregation time, and timeout rates.

**Version your protobufs carefully**: Use protobuf field numbers thoughtfully and never reuse them. Add new message types rather than modifying existing ones.

**Handle partial failures**: Design your aggregation logic to return partial results when some services fail but others succeed.

## Conclusion

Blended protobufs provide an elegant, type-safe solution for request correlation in gRPC microservices. By leveraging bidirectional streaming and the `oneof` pattern, you can build aggregation gateways that naturally maintain correlation without complex external state management.

The pattern scales horizontally, handles failures gracefully, and provides the type safety and performance characteristics that make gRPC an excellent choice for microservices architectures. Whether you're building a simple API gateway or a complex service mesh, blended protobufs offer a robust foundation for correlation in asynchronous environments.
