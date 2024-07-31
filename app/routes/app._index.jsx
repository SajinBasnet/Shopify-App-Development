import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { useState } from "react";
import { useLoaderData } from "@remix-run/react";
import { Page, Card, Button, ResourceList, ResourceItem, Thumbnail } from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const myHeaders = new Headers();
  myHeaders.append("X-Shopify-Access-Token", session.accessToken);

  const fetchOptions = {
    method: "GET",
    headers: myHeaders,
    redirect: "follow",
  };

  const [productsResponse, customersResponse, ordersResponse] = await Promise.all([
    fetch(
      `https://${session.shop}/admin/api/2024-04/products.json?limit=250`,
      fetchOptions
    ),
    fetch(
      `https://${session.shop}/admin/api/2024-04/customers.json?limit=250`,
      fetchOptions
    ),
    fetch(
      `https://${session.shop}/admin/api/2024-04/orders.json?status=any&limit=250`,
      fetchOptions
    ),
  ]);

  const productsResult = await productsResponse.json();
  const customersResult = await customersResponse.json();
  const ordersResult = await ordersResponse.json();

  const products = productsResult.products || [];
  const customers = customersResult.customers || [];
  const orders = ordersResult.orders || [];

  // Aggregate sales data
  const productSales = {};

  orders.forEach(order => {
    order.line_items.forEach(item => {
      if (productSales[item.product_id]) {
        productSales[item.product_id] += item.quantity;
      } else {
        productSales[item.product_id] = item.quantity;
      }
    });
  });

  // Sort products by sales
  const sortedProducts = products
    .map(product => ({
      ...product,
      sales_count: productSales[product.id] || 0,
    }))
    .sort((a, b) => b.sales_count - a.sales_count)
    .slice(0, 5);

  // Sort most valuable customers by total_spent in descending order
  const sortedCustomers = customers.sort((a, b) => Number(b.total_spent) - Number(a.total_spent)).slice(0, 5);

  return json({ bestSellingProducts: sortedProducts, mostValuableCustomers: sortedCustomers });
};

export default function Index() {
  const { bestSellingProducts, mostValuableCustomers } = useLoaderData();
  const [showProducts, setShowProducts] = useState(false);
  const [showCustomers, setShowCustomers] = useState(false);

  const renderProducts = () => (
    <Card>
      <ResourceList
        resourceName={{ singular: 'product', plural: 'products' }}
        items={bestSellingProducts}
        renderItem={(product) => {
          const { id, title, vendor, variants, image } = product;
          const price = variants[0]?.price || 'N/A';
          const media = image ? (
            <Thumbnail source={image.src} alt={image.alt || title} />
          ) : (
            <Thumbnail source="" alt="No image available" />
          );

          return (
            <ResourceItem
              id={id}
              media={media}
              accessibilityLabel={`View details for ${title}`}
            >
              <h3>
                <b>Product Name: </b>{title}
              </h3>
              <div><b>Vendor:</b> {vendor}</div>
              <div><b>Price:</b> ${price}</div>
              <div><b>Sales Count:</b> {product.sales_count}</div>
            </ResourceItem>
          );
        }}
      />
    </Card>
  );



  const renderCustomers = () => (
    <Card>
      <ResourceList
        resourceName={{ singular: 'customer', plural: 'customers' }}
        items={mostValuableCustomers}
        renderItem={(customer) => {
          const { id, first_name, last_name, total_spent,email,orders_count } = customer;

          return (
            <ResourceItem id={id} accessibilityLabel={`View details for ${first_name} ${last_name}`}>
              <h3>
                <b>Name: </b>{first_name} {last_name}
              </h3>
              <div><b>Email: </b>{email}</div>
                <div><b>Total_Orders: </b>{orders_count }</div>
              <div><b>Total Spent:</b> ${total_spent}</div>
            </ResourceItem>
          );
        }}
      />
    </Card>
  );

  return (
    <Page>
        <div style={{ marginBottom: '20px' }}>
      <Button  variant="primary" tone="critical" onClick={() => { setShowProducts(!showProducts); setShowCustomers(false); }}>
        {showProducts ? "Hide Top Selling Products" : "Show Top Selling Products"}
      </Button> | <Button  variant="primary" tone="critical" onClick={() => { setShowCustomers(!showCustomers); setShowProducts(false); }}>
        {showCustomers ? "Hide Most Valuable Customers" : "Show Most Valuable Customers"}
      </Button>
      </div>
      {showProducts && renderProducts()}
      {showCustomers && renderCustomers()}
    </Page>
  );
}
