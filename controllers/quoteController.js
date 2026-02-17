const { ObjectId } = require('mongodb');
const database = require('../services/database');

class QuoteController {
  /**
   * Create a new quote request.
   */
  async createQuote(req, res) {
    try {
      const {
        buyerId,
        buyerName,
        productName,
        requestedQuantity,
        items,
        buyerAddress,
        productId,
        sellerId,
        targetedPrice,
        deliveryDate,
        status,
        isBroadcast 
      } = req.body;

      if (!buyerId || !buyerName) {
        return res.status(400).json({ error: 'buyerId and buyerName are required' });
      }

      let finalItems = items || [
        {
          productId: productId,
          productName: productName,
          quantity: requestedQuantity
        }
      ];

      const quotesCollection = database.getQuotesCollection();
      const productsCollection = database.getProductsCollection();
      const usersCollection = database.getUsersCollection();

      const now = new Date();
      let matchedSellers = [];
      let broadcastStatus = null;

      if (sellerId === 'BROADCAST' || sellerId === 'MULTIPLE' || !sellerId || isBroadcast === true || isBroadcast === 'true') {
        let masterProductIds = [];
        
        for (const item of finalItems) {
          let masterProduct = null;
          if (item.productId) {
            try {
              masterProduct = await productsCollection.findOne({
                _id: new ObjectId(item.productId),
                isMaster: true
              });
            } catch (e) {
              masterProduct = await productsCollection.findOne({ name: item.productName, isMaster: true });
            }
          } else {
            masterProduct = await productsCollection.findOne({ name: item.productName, isMaster: true });
          }
          if (masterProduct) masterProductIds.push(masterProduct._id.toString());
        }

        if (masterProductIds.length > 0) {
          const sellerProducts = await productsCollection.find({
            masterProductId: { $in: masterProductIds },
            isMaster: false,
            status: 'Active'
          }).toArray();

          const uniqueSellerIds = [...new Set(sellerProducts.map(p => p.sellerId).filter(id => id))];

          for (const id of uniqueSellerIds) {
            try {
              const seller = await usersCollection.findOne({
                _id: new ObjectId(id),
                role: 'Seller'
              });
              if (seller) {
                matchedSellers.push({
                  sellerId: id,
                  sellerName: seller.name || 'Unknown Seller'
                });
              }
            } catch (err) {
              console.error(`Error fetching seller ${id}:`, err.message);
            }
          }
          broadcastStatus = matchedSellers.length > 0 ? 'BROADCASTED' : 'NO_SELLERS';
        } else {
          broadcastStatus = 'GENERAL_BROADCAST';
        }
      }

      const quoteData = {
        buyerId: buyerId,
        buyerName: buyerName,
        items: finalItems,
        productName: finalItems[0]?.productName || productName || 'Steel Items',
        requestedQuantity: finalItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0),
        buyerAddress: buyerAddress || null,
        sellerId: (sellerId === 'BROADCAST' || sellerId === 'MULTIPLE' || isBroadcast) ? null : sellerId,
        targetedPrice: targetedPrice || null,
        deliveryDate: deliveryDate || null,
        status: status || 'Pending',
        isBroadcast: isBroadcast === true || isBroadcast === 'true' || sellerId === 'BROADCAST' || !sellerId, 
        broadcastStatus: broadcastStatus,
        matchedSellersCount: matchedSellers.length,
        matchedSellers: matchedSellers,
        offers: [], // Initialize empty offers array
        createdAt: now,
        updatedAt: now
      };

      const result = await quotesCollection.insertOne(quoteData);
      quoteData._id = result.insertedId;

      res.status(201).json({
        success: true,
        message: broadcastStatus === 'BROADCASTED'
          ? `Quote created and broadcasted to ${matchedSellers.length} seller(s)`
          : 'Quote created successfully',
        quote: quoteData
      });
    } catch (error) {
      console.error('Create quote error:', error);
      res.status(500).json({ error: 'Failed to create quote', details: error.message });
    }
  }

  /**
   * Fetch a single quote by ID (Required for Flutter Detail Refresh)
   */
  async getQuoteById(req, res) {
    try {
      const { id } = req.params;
      const quotesCollection = database.getQuotesCollection();
      const quote = await quotesCollection.findOne({ _id: new ObjectId(id) });
      
      if (!quote) return res.status(404).json({ error: 'Quote not found' });
      
      res.json(quote);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch quote details' });
    }
  }

  /**
   * FETCH ALL AVAILABLE QUOTES FOR SELLERS
   */
  async getAvailableQuotes(req, res) {
    try {
      const quotesCollection = database.getQuotesCollection();
      
      const quotes = await quotesCollection
        .find({
          $and: [
            {
              $or: [
                { isBroadcast: true },
                { isBroadcast: 'true' },
                { sellerId: null },
                { sellerId: "" },
                { broadcastStatus: 'BROADCASTED' },
                { broadcastStatus: 'GENERAL_BROADCAST' }
              ]
            },
            { 
              status: { $in: ['Pending', 'pending', 'Quoted', 'quoted'] } 
            }
          ]
        })
        .sort({ createdAt: -1 })
        .toArray();

      res.json(quotes);
    } catch (error) {
      console.error('Get available quotes error:', error);
      res.status(500).json({ error: 'Failed to fetch available quotes' });
    }
  }

  /**
   * Seller submits a specific rate for a broadcasted quote.
   */
  async submitSellerOffer(req, res) {
    try {
      const { id } = req.params; 
      const { sellerId, sellerName, offeredPrice, message, timestamp } = req.body;
      const quotesCollection = database.getQuotesCollection();

      const newOffer = {
        offerId: new ObjectId().toString(),
        sellerId: sellerId,
        sellerName: sellerName,
        offeredPrice: parseFloat(offeredPrice),
        message: message || "",
        status: 'Pending',
        timestamp: timestamp ? new Date(timestamp) : new Date()
      };

      // Ensure buyerAddress and buyerPhone are included in the quote
      await quotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $setOnInsert: {
            buyerAddress: req.body.buyerAddress || null,
            buyerPhone: req.body.buyerPhone || null
          }
        }
      );

      // Atomic update: Remove old bid from this seller and push the new one
      await quotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $pull: { offers: { sellerId: sellerId } }
        }
      );

      const result = await quotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $push: { offers: newOffer },
          $set: { status: 'Quoted', updatedAt: new Date() } 
        }
      );

      if (result.matchedCount === 0) return res.status(404).json({ error: 'Quote not found' });

      res.json({ success: true, offer: newOffer });
    } catch (error) {
      console.error('Submit seller offer error:', error);
      res.status(500).json({ error: 'Failed to submit offer' });
    }
  }

  /**
   * Buyer accepts one specific offer from the list.
   */
  async acceptSellerOffer(req, res) {
    try {
      const { id } = req.params;
      const { offerId, sellerId, sellerName, finalPrice } = req.body;
      const quotesCollection = database.getQuotesCollection();

      const result = await quotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            status: 'Accepted', 
            sellerId: sellerId, 
            sellerName: sellerName,
            finalPrice: finalPrice, // This maps to widget.price in Flutter
            acceptedOfferId: offerId,
            updatedAt: new Date() 
          } 
        }
      );

      res.json({ success: true, message: 'Offer accepted. Proceeding to payment.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to accept offer' });
    }
  }

  async getQuotesByBuyer(req, res) {
    try {
      const { buyerId } = req.params;
      const quotesCollection = database.getQuotesCollection();
      
      const quotes = await quotesCollection
        .find({ buyerId: buyerId })
        .sort({ createdAt: -1 })
        .toArray();

      // FIXED: Map result to ensure id and offers are always available for Flutter
      const formattedQuotes = quotes.map(q => ({
        ...q,
        id: q._id.toString(),
        offers: q.offers || []
      }));

      res.json(formattedQuotes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get quotes' });
    }
  }

  async getQuotesBySeller(req, res) {
    try {
      const { sellerId } = req.params;
      const quotesCollection = database.getQuotesCollection();
      const quotes = await quotesCollection
        .find({
          $or: [
            { sellerId: sellerId },
            {
              sellerId: null,
              'matchedSellers.sellerId': sellerId
            }
          ]
        })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get quotes' });
    }
  }

  /**
   * Mark quote as paid and move to Processing status
   */
  async markAsPaid(req, res) {
    try {
      const { id } = req.params;
      const quotesCollection = database.getQuotesCollection();
      
      const result = await quotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            status: 'Processing',
            paidAt: new Date(),
            updatedAt: new Date()
          } 
        }
      );
      
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Quote not found' });
      
      res.json({ success: true, message: 'Payment confirmed. Order moved to Processing.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to mark as paid' });
    }
  }

  async updateQuote(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const quotesCollection = database.getQuotesCollection();
      updateData.updatedAt = new Date();
      const result = await quotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Quote not found' });
      const updatedQuote = await quotesCollection.findOne({ _id: new ObjectId(id) });
      res.json({ success: true, quote: updatedQuote });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update quote' });
    }
  }
}

module.exports = new QuoteController();